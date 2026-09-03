import os
import sys
import re
import uuid
import json
import asyncio
import time
import random
import redis
import requests
from starlette.applications import Starlette
from starlette.responses import JSONResponse, HTMLResponse, StreamingResponse
from starlette.routing import Route, Mount
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        # Use selector event loop on Windows to eliminate [WinError 10054] connection lost noise
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

# Add parent directory to path to load packages
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from open_webui.client import OpenWebUIClient
from open_webui.app.settings import (
    OPENWEBUI_BASE_URL, OPENWEBUI_ADMIN_TOKEN,
    REDIS_URL, REDIS_QUEUE_NAME, get_redis_client,
    AGENTS_DIR, LDAP_HOST, LDAP_PORT, LDAP_BASE_DN,
    LDAP_BIND_USER, LDAP_BIND_PASSWORD, LDAP_DOMAIN
)
import open_webui.app.core.database as db
from open_webui.app.core.ldap_client import LDAPClient, sync_ldap_user_to_openwebui
from open_webui.app.core.prompt_utils import load_system_prompt_template, interpolate_prompt_variables

# Initialize database migrations
db.run_migrations()

# Initialize connection clients
redis_client = get_redis_client()
openwebui_client = OpenWebUIClient(OPENWEBUI_BASE_URL, OPENWEBUI_ADMIN_TOKEN)


def get_client(request) -> OpenWebUIClient:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        return OpenWebUIClient(OPENWEBUI_BASE_URL, token)
    return openwebui_client


REACT_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

# Base API / App Subpath (configurable via .env or directly here)
# Example: APP_BASE_PATH = "/sandbox" (for http://aiva.aapico.com/sandbox) or "" (default root)
APP_BASE_PATH = os.environ.get("APP_BASE_PATH", os.environ.get("BASE_API", "/sandbox")).strip().rstrip("/")


async def homepage(request):
    """Serve the single page application interface (React dist or fallback template)."""
    dist_index = os.path.join(REACT_DIST_DIR, "index.html")
    if os.path.exists(dist_index):
        with open(dist_index, "r", encoding="utf-8") as f:
            html_content = f.read()

        # Inject runtime config from .env or main.py into <head>
        config_payload = json.dumps({"apiBase": APP_BASE_PATH, "basePath": APP_BASE_PATH})
        config_script = f'<script>window.__APP_CONFIG__ = {config_payload};</script>'
        if "</head>" in html_content:
            html_content = html_content.replace("</head>", f"  {config_script}\n</head>", 1)
        return HTMLResponse(html_content)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    tmpl_path = os.path.join(base_dir, "templates", "index.html")
    with open(tmpl_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(html_content)


async def request_form_page(request):
    """Serve the AI Sandbox Request Form (standalone HTML portal for employees)."""
    # Look for request_form.html one level up from app/ (i.e., open_webui/request_form.html)
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "request_form.html"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "request_form.html"),
    ]
    for path in candidates:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            with open(abs_path, "r", encoding="utf-8") as f:
                return HTMLResponse(f.read())
    return HTMLResponse("<h1>Request form not found.</h1>", status_code=404)


async def email_preview_page(request):
    """Serve live interactive preview of the AI Sandbox Approval Email Template."""
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "email_approval_template.html"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "email_approval_template.html"),
    ]
    for path in candidates:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            with open(abs_path, "r", encoding="utf-8") as f:
                html = f.read()

            params = request.query_params
            user_name = params.get("user_name", "Wajeepradit Prompan (AH)")
            user_email = params.get("user_email", "wajeepradit.p@aapico.com")
            department = params.get("department", "Digital Innovation")
            project_name = params.get("project_name", "Smart Factory AI Copilot")
            fqdn = params.get("fqdn", "http://pb-wajeepraditp.10.10.3.111.sslip.io")
            agent_model_id = params.get("agent_model_id", "pocketbase-agent-wajeepraditp")

            html = html.replace("{{ user_name }}", user_name)
            html = html.replace("{{ user_email }}", user_email)
            html = html.replace("{{ department | default('Digital Innovation') }}", department)
            html = html.replace("{{ project_name | default('AI Sandbox Environment') }}", project_name)
            html = html.replace("{{ fqdn }}", fqdn)
            html = html.replace("{{ fqdn | default('https://pb-sandbox.aapico.com') }}", fqdn)
            html = html.replace("{{ agent_model_id | default('pocketbase-agent') }}", agent_model_id)
            html = html.replace("{{ openwebui_url | default('http://10.10.3.111:3000') }}", "http://10.10.3.111:3000")
            html = html.replace("{{ job_uuid | default('AUTO-GEN') }}", "4f022b79-4596-4fbe-bbe2-bc7e1f0ce441")
            return HTMLResponse(html)
    return HTMLResponse("<h1>Email template not found</h1>", status_code=404)


async def validate_auth_api(request):
    """Authenticate and verify the Open WebUI token via GET or POST."""
    try:
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1].strip()
            
        if not token:
            token = request.query_params.get("token")
            
        if not token and request.method == "POST":
            try:
                body = await request.json()
                token = body.get("token")
            except Exception:
                pass

        if not token:
            token = OPENWEBUI_ADMIN_TOKEN

        if not token:
            return JSONResponse({"status": "invalid", "detail": "Token is required"}, status_code=400)

        temp_client = OpenWebUIClient(OPENWEBUI_BASE_URL, token)
        user = temp_client.get_current_user()

        if user:
            return JSONResponse({"status": "valid", "user": user, "token": token})
        else:
            return JSONResponse({"status": "invalid", "detail": "Invalid session token"}, status_code=401)
    except Exception as e:
        return JSONResponse({"status": "invalid", "detail": f"Authentication failed: {str(e)}"}, status_code=401)


async def login_api(request):
    """Authenticate and verify the Open WebUI token."""
    return await validate_auth_api(request)


async def get_ldap_health(request):
    """Check LDAP connection configuration health."""
    try:
        client = LDAPClient()
        if client.is_configured():
            return JSONResponse({"status": "healthy", "domain": LDAP_DOMAIN or "aapico.com"})
        return JSONResponse({"status": "not_configured", "domain": LDAP_DOMAIN or "aapico.com"})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


async def create_user_api(request):
    """Dynamically register/signup a user in Open WebUI if they don't exist yet."""
    try:
        body = await request.json()
        email = body.get("email")
        name = body.get("name")
        if not email or not name:
            return JSONResponse({"detail": "Name and Email are required"}, status_code=400)
            
        import secrets
        import string
        client = get_client(request)
        url = f"{client.base_url}/api/v1/auths/add"
        alphabet = string.ascii_letters + string.digits
        random_password = "".join(secrets.choice(alphabet) for _ in range(16))
        
        payload = {
            "name": name,
            "email": email,
            "password": random_password,
            "role": "user"
        }
        
        resp = requests.post(url, headers=client.headers, json=payload, timeout=10)
        if resp.status_code == 200:
            user_data = resp.json()
            created_user = user_data.get("user") if (isinstance(user_data, dict) and isinstance(user_data.get("user"), dict)) else user_data
            return JSONResponse({
                "status": "success",
                "user": {
                    "id": created_user.get("id"),
                    "name": created_user.get("name"),
                    "email": created_user.get("email"),
                    "role": created_user.get("role", "user")
                },
                "password": random_password
            })
        else:
            try:
                err_detail = resp.json().get("detail", resp.text)
            except Exception:
                err_detail = resp.text
            return JSONResponse({
                "detail": f"Failed to register user in Open WebUI: {err_detail}"
            }, status_code=resp.status_code)
    except Exception as e:
        return JSONResponse({"detail": f"Error: {str(e)}"}, status_code=500)


async def get_users(request):
    """Fetch Open WebUI user lists to select from in the frontend UI."""
    try:
        q = request.query_params.get("q", "").strip().lower()
        client = get_client(request)
        users = client.get_users()
        serialized_users = []
        for u in users:
            name = u.get("name") or ""
            email = u.get("email") or ""
            username = u.get("username") or ""
            
            if q and q not in name.lower() and q not in email.lower() and q not in username.lower():
                continue
                
            serialized_users.append({
                "id": u.get("id"),
                "name": u.get("name"),
                "email": u.get("email"),
                "role": u.get("role")
            })
        return JSONResponse(serialized_users)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def get_ldap_users(request):
    """Search users from LDAP directory and check if registered in Open WebUI."""
    try:
        q = request.query_params.get("q", "").strip()
        client = LDAPClient()
        if not client.is_configured():
            return JSONResponse({
                "status": "not_configured",
                "message": "LDAP is not configured in .env (LDAP_HOST or LDAP_BASE_DN missing).",
                "users": []
            })

        ldap_users = client.search_users(query=q)

        # Cross-reference with Open WebUI users
        owu_client = get_client(request)
        try:
            owu_users = owu_client.get_users()
            owu_email_map = {(u.get("email") or "").lower(): u for u in owu_users}
            owu_username_map = {(u.get("username") or u.get("name") or "").lower(): u for u in owu_users}
        except Exception:
            owu_email_map = {}
            owu_username_map = {}

        enriched = []
        domain = LDAP_DOMAIN or "aapico.com"
        for u in ldap_users:
            sam_account = u.get("sAMAccountName") or u.get("username") or ""
            standard_email = f"{sam_account}@{domain}".lower()
            
            matched_owu = owu_email_map.get(standard_email) or owu_username_map.get(sam_account.lower())
            enriched.append({
                "username": sam_account,
                "sAMAccountName": sam_account,
                "name": u.get("name") or sam_account,
                "email": standard_email,
                "department": u.get("department"),
                "title": u.get("title"),
                "in_openwebui": bool(matched_owu),
                "owu_id": matched_owu.get("id") if matched_owu else None,
                "owu_role": matched_owu.get("role") if matched_owu else None,
            })

        return JSONResponse({
            "status": "success",
            "count": len(enriched),
            "users": enriched
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e), "users": []}, status_code=500)


async def sync_ldap_user(request):
    """Auto-register an LDAP user into Open WebUI if not yet present."""
    try:
        body = await request.json()
        owu_client = get_client(request)
        res = sync_ldap_user_to_openwebui(body, owu_client)
        return JSONResponse(res)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=400)


async def get_agent_templates(request):
    """Discover all agent templates from agents directory and templates pool."""
    try:
        templates = []
        seen_filenames = set()

        search_dirs = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "templates", "agents")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "templates")),
            AGENTS_DIR,
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "agents")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
            os.path.abspath(os.path.dirname(__file__)),
        ]

        for sdir in search_dirs:
            if not os.path.exists(sdir):
                continue
            for f in os.listdir(sdir):
                if (f.endswith("_agent.json") or f == "pocketbase_agent.json") and f not in seen_filenames:
                    seen_filenames.add(f)
                    fpath = os.path.join(sdir, f)
                    try:
                        with open(fpath, "r", encoding="utf-8") as tfile:
                            data = json.load(tfile)
                            loaded_prompt = load_system_prompt_template("system_prompt.md")
                            sys_prompt = loaded_prompt if (loaded_prompt and ("pocketbase" in f or f == "pocketbase_agent.json")) else data.get("params", {}).get("system", "")
                            templates.append({
                                "filename": f,
                                "file": f,
                                "id": data.get("id", f),
                                "name": data.get("name", f),
                                "base_model_id": data.get("base_model_id", "deepseek-v4-flash"),
                                "description": data.get("meta", {}).get("description", ""),
                                "tool_ids": data.get("meta", {}).get("toolIds", []),
                                "system_prompt": sys_prompt,
                                "params": data.get("params", {}),
                                "valves": data.get("params", {}).get("valves", {})
                            })
                    except Exception as err:
                        print(f"[WARNING] Failed to parse template {fpath}: {err}")

        return JSONResponse({"status": "success", "templates": templates})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def get_single_agent_template(request):
    """Return content of a specific agent template file with loaded system_prompt.md."""
    try:
        filename = request.path_params.get("filename", "")
        search_dirs = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "templates", "agents")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "templates")),
            AGENTS_DIR,
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "agents")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
            os.path.abspath(os.path.dirname(__file__)),
        ]
        for sdir in search_dirs:
            fpath = os.path.join(sdir, filename)
            if os.path.exists(fpath):
                with open(fpath, "r", encoding="utf-8") as tf:
                    data = json.load(tf)
                    loaded_prompt = load_system_prompt_template("system_prompt.md")
                    if loaded_prompt:
                        data["system_prompt"] = loaded_prompt
                        if "params" in data and isinstance(data["params"], dict):
                            data["params"]["system"] = loaded_prompt
                    elif "params" in data and isinstance(data["params"], dict):
                        data["system_prompt"] = data["params"].get("system", "")
                    return JSONResponse(data)
        return JSONResponse({"detail": f"Template {filename} not found"}, status_code=404)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


def find_default_template_path():
    candidates = [
        os.path.join(os.path.dirname(__file__), "templates", "default_template.json"),
        os.path.join(os.path.dirname(__file__), "default_template.json"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]


DEFAULT_TEMPLATE_PATH = find_default_template_path()


def load_default_template_data() -> dict:
    """Load default template constants from default_template.json with fallback defaults and system prompt template."""
    fallback_defaults = {
        "version": "1.0.0",
        "app": {
            "title": "PocketBase & Open WebUI Provisioning Portal",
            "description": "Automated deployment engine connecting Coolify, PocketBase, Active Directory LDAP, and Open WebUI"
        },
        "ldap": {
            "default_domain": LDAP_DOMAIN or "aapico.com"
        },
        "pocketbase": {
            "service_name_prefix": "pocketbase-",
            "subdomain_prefix": "pb-",
            "domain_suffix": "10.10.3.111.sslip.io",
            "fqdn_template": "http://pb-{username}.10.10.3.111.sslip.io",
            "admin_email_pattern": f"{{username}}@{LDAP_DOMAIN or 'aapico.com'}",
            "default_password_length": 14,
            "docker_image": "ghcr.io/muchobien/pocketbase:latest"
        },
        "openwebui": {
            "default_template_file": "pocketbase_agent.json",
            "system_prompt_file": "system_prompt.md",
            "agent_name_pattern": "PocketBase Agent - {username}",
            "base_model_id": "deepseek-v4-flash",
            "tool_ids": ["pocketbase"],
            "system_prompt": "You are a PocketBase automation expert. You have direct access to tools for querying, creating, and updating database collections and records for the target user.",
            "default_permission": "read_write"
        },
        "pipeline": {
            "total_steps": 6,
            "stages": [
                "Initializing",
                "Syncing User to Open WebUI",
                "Deploying PocketBase",
                "Waiting for Health",
                "Verifying Admin",
                "Registering Agent"
            ]
        }
    }

    result = fallback_defaults
    if os.path.exists(DEFAULT_TEMPLATE_PATH):
        try:
            with open(DEFAULT_TEMPLATE_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    result = loaded
        except Exception as e:
            print(f"[WARNING] Failed to load {DEFAULT_TEMPLATE_PATH}: {e}")

    # If system_prompt_file is specified, attempt to load prompt template from file
    owu = result.get("openwebui", {})
    prompt_file = owu.get("system_prompt_file") or "system_prompt.md"
    if prompt_file:
        loaded_prompt = load_system_prompt_template(prompt_file)
        if loaded_prompt:
            owu["system_prompt"] = loaded_prompt
            result["openwebui"] = owu

    return result


async def get_default_template(request):
    """Return default template configuration for frontend constants."""
    data = load_default_template_data()
    return JSONResponse(data)


async def get_owu_models(request):
    """Proxy available base models directly from Open WebUI."""
    try:
        client = get_client(request)
        url = f"{client.base_url}/api/models"
        resp = requests.get(url, headers=client.headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            models = []
            for m in data:
                models.append({
                    "id": m.get("id"),
                    "name": m.get("name") or m.get("id"),
                })
            return JSONResponse(models)
        return JSONResponse({"detail": f"HTTP {resp.status_code}"}, status_code=resp.status_code)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def get_jobs(request):
    """Retrieve job history details from SQLite."""
    try:
        jobs = db.get_all_jobs()
        return JSONResponse(jobs)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def clear_jobs_api(request):
    """Clear all historical deployment job logs."""
    try:
        count = db.delete_all_jobs()
        return JSONResponse({"status": "success", "deleted_count": count})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def delete_single_job_api(request):
    """Delete a single job log by UUID."""
    try:
        job_uuid = request.path_params.get("job_uuid")
        ok = db.delete_job(job_uuid)
        if ok:
            return JSONResponse({"status": "success", "job_uuid": job_uuid})
        return JSONResponse({"detail": f"Job {job_uuid} not found"}, status_code=404)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def create_job(request):
    """Accept target user and deployment configuration, create SQLite record, and queue job."""
    try:
        body = await request.json()
        
        # 1. Target User Section (supports target_user, user, or top-level keys)
        target_user = body.get("target_user") or body.get("user") or {}
        user_id = target_user.get("id") or body.get("user_id")
        user_name = target_user.get("name") or body.get("user_name") or target_user.get("displayName")
        user_email = target_user.get("email") or body.get("user_email") or target_user.get("mail")
        username = target_user.get("username") or target_user.get("sAMAccountName") or body.get("username")
        
        # 2. PocketBase / Coolify Service Section
        pb_config = body.get("pocketbase") or body.get("coolify_service") or {}
        service_username = pb_config.get("username_prefix") or pb_config.get("username") or body.get("service_username")
        service_password = pb_config.get("admin_password") or pb_config.get("service_password") or body.get("service_password")
        admin_email = pb_config.get("admin_email") or body.get("admin_email")

        # Intelligent fallbacks for user_email
        if not user_email:
            user_email = admin_email
        if not user_email and (username or service_username or user_name):
            cand_user = username or service_username or user_name
            cleaned_cand = re.sub(r'[^a-zA-Z0-9]', '', str(cand_user)).lower()
            user_email = f"{cleaned_cand}@{LDAP_DOMAIN or 'aapico.com'}"
            
        if not user_name:
            user_name = username or (user_email.split("@")[0] if user_email else "Target User")

        if not user_email:
            return JSONResponse({"detail": "Missing target user email parameter"}, status_code=400)
            
        # If user_id is not yet present, auto-sync with Open WebUI
        if not user_id:
            try:
                owu_client = get_client(request)
                sync_res = sync_ldap_user_to_openwebui({
                    "username": username or user_name,
                    "name": user_name or user_email,
                    "email": user_email
                }, owu_client)
                user_id = sync_res.get("user", {}).get("id")
            except Exception as sync_err:
                print(f"[WARNING] Immediate auto-sync in create_job: {sync_err}")

        job_uuid = str(uuid.uuid4())

        # 3. Open WebUI Agent Section
        owu_config = body.get("openwebui") or body.get("openwebui_agent") or {}
        template_name = owu_config.get("template_name") or body.get("template_name", "pocketbase_agent.json")
        system_prompt_file = owu_config.get("system_prompt_file") or body.get("system_prompt_file") or "system_prompt.md"
        agent_id = owu_config.get("agent_id") or body.get("agent_id")
        agent_name = owu_config.get("agent_name") or body.get("agent_name")
        system_prompt = owu_config.get("system_prompt") or body.get("system_prompt")
        base_model_id = owu_config.get("base_model_id") or body.get("base_model_id")
        tool_ids = owu_config.get("tool_ids") if owu_config.get("tool_ids") is not None else body.get("tool_ids")
        extra_params = owu_config.get("extra_params") or body.get("extra_params")
        access_grants = owu_config.get("access_grants") if owu_config.get("access_grants") is not None else body.get("access_grants", [])

        auth_client = get_client(request)
        active_owu_token = getattr(auth_client, "token", getattr(auth_client, "api_token", None)) or OPENWEBUI_ADMIN_TOKEN

        # Clean structured task payload
        task_payload = {
            "job_uuid": job_uuid,
            "target_user": {
                "id": user_id,
                "name": user_name,
                "email": user_email,
                "username": username
            },
            "pocketbase": {
                "username_prefix": service_username,
                "admin_email": admin_email,
                "admin_password": service_password
            },
            "openwebui": {
                "openwebui_token": active_owu_token,
                "template_name": template_name,
                "system_prompt_file": system_prompt_file,
                "agent_id": agent_id,
                "agent_name": agent_name,
                "base_model_id": base_model_id,
                "system_prompt": system_prompt,
                "tool_ids": tool_ids,
                "extra_params": extra_params,
                "access_grants": access_grants
            },
            # Top-level legacy aliases for compatibility
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email
        }

        # Create record in DB with config
        db.create_job(job_uuid, user_id, user_email, user_name, config=task_payload)
        
        # Push task payload to Redis queue
        redis_client.rpush(REDIS_QUEUE_NAME, json.dumps(task_payload))
        
        return JSONResponse({"job_uuid": job_uuid, "status": "accepted", "task_payload": task_payload})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def get_job_by_uuid(request):
    """Retrieve details and execution steps for a specific job."""
    job_uuid = request.path_params.get("job_uuid")
    job = db.get_job(job_uuid)
    if job:
        return JSONResponse(job)
    return JSONResponse({"detail": "Job not found"}, status_code=404)


async def job_events(request):
    """Stream real-time log messages to UI using Server-Sent Events (SSE)."""
    job_uuid = request.path_params.get("job_uuid")
    
    async def event_generator():
        last_step_count = -1
        last_status = None
        
        # Immediate keepalive handshake
        yield ": sse-stream-ready\n\n"
        
        # Stream updates for up to 10 minutes (600 iterations of 0.8s)
        for _ in range(600):
            if await request.is_disconnected():
                break
                
            job = db.get_job(job_uuid)
            if job:
                steps = job.get("steps") or []
                status = job.get("status") or "pending"
                
                # If there are new steps or status changed, yield an SSE update
                if len(steps) != last_step_count or status != last_status:
                    last_step_count = len(steps)
                    last_status = status
                    
                    latest_step = steps[-1] if steps else {}
                    data_obj = {
                        "job_uuid": job["job_uuid"],
                        "user_name": job.get("user_name"),
                        "user_email": job.get("user_email"),
                        "service_name": job.get("service_name"),
                        "fqdn": job.get("fqdn"),
                        "status": status,
                        "step_name": latest_step.get("step_name", "Initializing"),
                        "detail": latest_step.get("detail", ""),
                        "steps": steps
                    }
                    payload_json = json.dumps(data_obj)
                    yield f"event: message\ndata: {payload_json}\n\n"
                    
                    if status in ("completed", "failed"):
                        break
            else:
                yield ": keepalive\n\n"
            
            await asyncio.sleep(0.8)
            
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# -------------------------------------------------------------------------
# SANDBOX PORTAL API (PERSISTENT & PRODUCTION READY)
# -------------------------------------------------------------------------

async def ldap_login_api(request):
    """Authenticate employee credentials via LDAP and return authentic directory attributes."""
    try:
        body = await request.json()
        raw_username = body.get("username", "").strip()
        password = body.get("password", "")
        if not raw_username:
            return JSONResponse({"detail": "Username is required."}, status_code=400)
        if not password:
            return JSONResponse({"detail": "Password is required."}, status_code=400)

        domain = LDAP_DOMAIN or "aapico.com"
        clean_user = raw_username.lower()
        if "@" in clean_user:
            clean_user = clean_user.split("@")[0]

        ldap_client = LDAPClient()
        ldap_user = None

        # 1. Query Active Directory for user details using service account
        try:
            ldap_user = ldap_client.get_user_by_username(clean_user)
        except Exception as query_err:
            print(f"[AUTH] LDAP lookup warning: {query_err}")

        # 2. Authenticate employee password against Active Directory if LDAP is online
        if ldap_user and LDAP_HOST:
            try:
                from ldap3 import Server, Connection
                server = Server(LDAP_HOST, port=LDAP_PORT, get_info=None, connect_timeout=1.5)
                user_bind_dn = f"{clean_user}@{domain}"
                user_conn = Connection(server, user=user_bind_dn, password=password, receive_timeout=4)
                if not user_conn.bind():
                    return JSONResponse({"detail": "Invalid Active Directory username or password."}, status_code=401)
                user_conn.unbind()
            except Exception as bind_err:
                print(f"[AUTH] Direct user bind notice: {bind_err}")

        # 3. Check Open WebUI user directory if LDAP is offline or user not found in AD
        if not ldap_user:
            owu_profile = None
            try:
                client = get_client(request)
                resp = requests.get(f"{client.base_url}/api/v1/users/", headers=client.headers, timeout=1.5)
                if resp.ok:
                    users_data = resp.json()
                    users = users_data.get("data", []) if isinstance(users_data, dict) else users_data
                    for u in users:
                        u_email = (u.get("email") or "").lower()
                        u_user = (u.get("username") or u.get("name") or "").lower()
                        if u_email == f"{clean_user}@{domain}".lower() or u_user == clean_user:
                            owu_profile = u
                            break
            except Exception:
                pass

            display_name = owu_profile.get("name") if (owu_profile and owu_profile.get("name")) else clean_user.replace(".", " ").title()
            user_email = owu_profile.get("email") if (owu_profile and owu_profile.get("email")) else f"{clean_user}@{domain}".lower()

            ldap_user = {
                "username": clean_user,
                "fullName": display_name,
                "email": user_email,
                "department": "",
                "employeeId": "",
                "approver": "",
            }

        final_profile = {
            "username": ldap_user.get("username") or clean_user,
            "fullName": ldap_user.get("fullName") or ldap_user.get("name") or clean_user,
            "email": ldap_user.get("email") or f"{clean_user}@{domain}".lower(),
            "department": ldap_user.get("department") or "",
            "employeeId": ldap_user.get("employeeId") or "",
            "approver": ldap_user.get("approver") or "",
            "title": ldap_user.get("title") or "",
        }

        session_token = f"ldap-sess-{uuid.uuid4().hex[:16]}"
        return JSONResponse({
            "status": "success",
            "user": final_profile,
            "token": session_token
        })
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def get_sandbox_requests(request):
    """Retrieve all sandbox requests from persistent database."""
    try:
        reqs = db.get_all_sandbox_requests()
        # If database is completely empty on fresh startup, seed sample requests
        if not reqs:
            seed_proposals = [
                {
                    "id": "req-1011",
                    "username": "kawee.w",
                    "fullName": "Kawee Wasaruchareekul",
                    "employeeId": "A-84920",
                    "department": "AHT Production Line 2",
                    "email": f"kawee.w@{LDAP_DOMAIN or 'aapico.com'}",
                    "approver": "Somchai Tech Lead (VP of AHT)",
                    "projectName": "Smart Welding Log",
                    "shortDescription": "Autonomous defect tracker capturing spot weld pressure anomalies via PocketBase API.",
                    "targetAudience": "Line Technicians, QA Supervisors",
                    "appType": "dashboard",
                    "status": "pending",
                    "created_at": "2026-03-01T09:30:00Z"
                },
                {
                    "id": "req-1012",
                    "username": "wachira.y",
                    "fullName": "Wachira Yeamnim",
                    "employeeId": "A-51034",
                    "department": "AH Automation Engineering",
                    "email": f"wachira.y@{LDAP_DOMAIN or 'aapico.com'}",
                    "approver": "Wichai Manager (VP of IT)",
                    "projectName": "Factory Asset Tracker",
                    "shortDescription": "Mobile QR scanning application for workshop calibration tools and CNC machinery.",
                    "targetAudience": "All Plant Technicians, Shift Leads",
                    "appType": "booking",
                    "status": "approved",
                    "created_at": "2026-02-27T14:15:00Z"
                }
            ]
            for s in seed_proposals:
                db.save_sandbox_request(s)
            reqs = db.get_all_sandbox_requests()
        return JSONResponse(reqs)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def create_sandbox_request(request):
    """Save submitted sandbox request into persistent SQLite database."""
    try:
        body = await request.json()
        req_id = f"req-{int(time.time()*1000)%100000:05d}"
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        new_req = {
            "id": req_id,
            "username": body.get("username", "anonymous"),
            "fullName": body.get("fullName", "Anonymous User"),
            "employeeId": body.get("employeeId", "A-XXXXX"),
            "department": body.get("department", "General Staff"),
            "email": body.get("email", f"user@{LDAP_DOMAIN or 'aapico.com'}"),
            "approver": body.get("approver", "Wichai Manager (VP of IT)"),
            "projectName": body.get("projectName", "Untitled Sandbox"),
            "shortDescription": body.get("shortDescription", ""),
            "targetAudience": body.get("targetAudience", "Internal Staff"),
            "appType": body.get("appType", "other"),
            "status": "pending",
            "created_at": now_iso
        }
        saved_req = db.save_sandbox_request(new_req)
        return JSONResponse({"status": "success", "request": saved_req})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def approve_sandbox_request(request):
    """Mark sandbox request as approved in database and return auto-fill deployment parameters."""
    req_id = request.path_params.get("req_id")
    r = db.update_sandbox_request_status(req_id, "approved")
    if not r:
        return JSONResponse({"detail": "Sandbox request not found."}, status_code=404)

    # Compute auto-fill parameters for the React frontend Deploy > Step 2
    username     = r.get("username", "user")
    project_name = r.get("projectName", username)
    full_name    = r.get("fullName", username)

    # Subdomain prefix: lowercase alphanumeric from project name
    import re as _re
    pb_subdomain = _re.sub(r'[^a-z0-9]', '', project_name.lower()) or username.lower()
    pb_fqdn      = f"http://pb-{pb_subdomain}.10.10.3.111.sslip.io"
    agent_name   = f"{project_name} agent - {username}"

    # Build redirect URL for the React Provisioning Portal
    from urllib.parse import urlencode as _urlencode
    params = _urlencode({
        "action":      "deploy_from_sandbox",
        "req_id":      req_id,
        "username":    username,
        "fullName":    full_name,
        "email":       r.get("email", f"{username}@{LDAP_DOMAIN or 'aapico.com'}"),
        "department":  r.get("department", ""),
        "project":     project_name,
        "subdomain":   pb_subdomain,
        "fqdn":        pb_fqdn,
        "agent_name":  agent_name,
    })
    redirect_url = f"/?{params}#sandbox-approve"

    return JSONResponse({
        "status": "success",
        "request": r,
        "auto_fill": {
            "pb_subdomain": pb_subdomain,
            "pb_fqdn":      pb_fqdn,
            "agent_name":   agent_name,
        },
        "redirect_url": redirect_url,
    })


async def reject_sandbox_request(request):
    """Mark sandbox request as rejected in database."""
    req_id = request.path_params.get("req_id")
    r = db.update_sandbox_request_status(req_id, "rejected")
    if not r:
        return JSONResponse({"detail": "Sandbox request not found."}, status_code=404)
    return JSONResponse({"status": "success", "request": r})


async def deploy_sandbox_request(request):
    """Directly trigger background automated deployment from an approved sandbox proposal."""
    req_id = request.path_params.get("req_id")
    target_req = db.get_sandbox_request(req_id)
    if not target_req:
        return JSONResponse({"detail": "Sandbox request not found."}, status_code=404)

    job_uuid = str(uuid.uuid4())
    username = target_req.get("username", "user")
    user_email = target_req.get("email", f"{username}@{LDAP_DOMAIN or 'aapico.com'}")
    user_name = target_req.get("fullName", username)
    project_name = target_req.get("projectName", username)

    import re as _re
    clean_subdomain = _re.sub(r'[^a-z0-9]', '', project_name.lower()) or username.lower()
    fqdn = f"http://pb-{clean_subdomain}.10.10.3.111.sslip.io"
    agent_name = f"{project_name} agent - {username}"

    task_payload = {
        "job_uuid": job_uuid,
        "target_user": {
            "id": target_req.get("employeeId") or None,
            "name": user_name,
            "email": user_email,
            "username": username
        },
        "pocketbase": {
            "username": clean_subdomain,
            "username_prefix": clean_subdomain,
            "admin_email": user_email,
            "admin_password": "SandboxPassword123!"
        },
        "openwebui": {
            "template_name": "pocketbase_agent.json",
            "agent_name": agent_name,
            "base_model_id": "deepseek-v4-flash",
            "tool_ids": ["pocketbase"]
        }
    }
    db.create_job(job_uuid, username, user_email, user_name, config=task_payload)
    try:
        redis_client.rpush(REDIS_QUEUE_NAME, json.dumps(task_payload))
    except Exception as err:
        print(f"[ERROR] Failed to push sandbox job to queue: {err}")

    db.update_sandbox_request_status(req_id, "deployed", deployed_job_uuid=job_uuid)

    return JSONResponse({
        "status": "started",
        "job_uuid": job_uuid,
        "redirect_url": f"/?active_job={job_uuid}#deploy"
    })


async def get_deployed_agents_api(request):
    """Retrieve list of agents deployed specifically via this orchestrator project, cross-referenced with active models in OpenWebUI."""
    try:
        # 1. Fetch active models from OpenWebUI API
        client = get_client(request)
        active_model_ids = set()
        owu_models_map = {}
        try:
            url = f"{client.base_url}/api/models"
            resp = requests.get(url, headers=client.headers, timeout=6)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for m in data:
                    mid = m.get("id")
                    if mid:
                        active_model_ids.add(mid)
                        owu_models_map[mid] = m
        except Exception as e_owu:
            print(f"[WARNING] Could not fetch active models from OpenWebUI: {e_owu}")

        # 2. Query project-deployed agents from Database
        db_agents = db.get_deployed_agents()

        # 3. Filter: MUST actually exist in OpenWebUI right now, and deduplicate by agent_model_id (latest job wins)
        verified_agents = []
        seen_agent_ids = set()

        for a in db_agents:
            model_id = a.get("agent_model_id")
            if not model_id:
                continue

            # Only include if actually present in OpenWebUI
            if active_model_ids and model_id not in active_model_ids:
                continue

            # Deduplicate by model_id to show only the latest active instance
            if model_id in seen_agent_ids:
                continue
            seen_agent_ids.add(model_id)

            # Enrich with real-time OpenWebUI model name if available
            owu_info = owu_models_map.get(model_id)
            if owu_info and owu_info.get("name"):
                a["agent_name"] = owu_info.get("name")

            verified_agents.append(a)

        return JSONResponse(verified_agents)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


async def delete_deployed_agent_api(request):
    """Queue teardown job to delete OpenWebUI agent and Coolify PocketBase container."""
    try:
        job_uuid = request.path_params.get("job_uuid")
        job = db.get_job(job_uuid)
        if not job:
            return JSONResponse({"detail": f"Job {job_uuid} not found"}, status_code=404)

        config = job.get("config") or {}
        owu_cfg = config.get("openwebui") or config.get("openwebui_agent") or {}

        agent_model_id = job.get("agent_model_id") or owu_cfg.get("agent_id") or config.get("agent_id")
        agent_name = owu_cfg.get("agent_name") or config.get("agent_name") or f"Agent - {job.get('user_name')}"
        coolify_service_uuid = job.get("coolify_service_uuid")

        # If coolify_service_uuid is not in column, check steps
        if not coolify_service_uuid:
            steps = job.get("steps") or []
            for s in steps:
                detail = s.get("detail", "")
                if "Service created with UUID:" in detail:
                    parts = detail.split("Service created with UUID:")
                    if len(parts) > 1:
                        uuid_part = parts[1].split(".")[0].strip()
                        if uuid_part:
                            coolify_service_uuid = uuid_part
                            break

        delete_job_uuid = str(uuid.uuid4())
        task_payload = {
            "job_type": "teardown",
            "action": "delete_agent",
            "delete_job_uuid": delete_job_uuid,
            "job_uuid": delete_job_uuid,
            "source_job_uuid": job_uuid,
            "agent_model_id": agent_model_id,
            "agent_name": agent_name,
            "coolify_service_uuid": coolify_service_uuid,
            "fqdn": job.get("fqdn")
        }

        # Create persistent teardown job record in SQLite for inspection and live tracking
        db.create_job(
            job_uuid=delete_job_uuid,
            user_id=job.get("user_id", "admin"),
            user_email=job.get("user_email", "admin@aapico.com"),
            user_name=job.get("user_name", "System"),
            config=task_payload
        )
        db.update_job_status(
            delete_job_uuid,
            status="pending",
            service_name=f"[Teardown] {agent_name}",
            fqdn=job.get("fqdn")
        )

        redis_client.rpush(REDIS_QUEUE_NAME, json.dumps(task_payload))

        return JSONResponse({
            "status": "queued",
            "delete_job_uuid": delete_job_uuid,
            "source_job_uuid": job_uuid,
            "agent_model_id": agent_model_id,
            "agent_name": agent_name
        })
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


routes = [
    Route("/", homepage),
    Route("/request", request_form_page),
    Route("/email-preview", email_preview_page, methods=["GET"]),
    Route("/api/login", login_api, methods=["GET", "POST"]),
    Route("/api/auth/validate", validate_auth_api, methods=["GET", "POST"]),
    Route("/api/auth/ldap-login", ldap_login_api, methods=["POST"]),
    Route("/api/users", get_users, methods=["GET"]),
    Route("/api/users/create", create_user_api, methods=["POST"]),
    Route("/api/users/sync-ldap", sync_ldap_user, methods=["POST"]),
    Route("/api/ldap/users", get_ldap_users, methods=["GET"]),
    Route("/api/ldap/sync", sync_ldap_user, methods=["POST"]),
    Route("/api/ldap/health", get_ldap_health, methods=["GET"]),
    Route("/api/agent-templates", get_agent_templates, methods=["GET"]),
    Route("/api/agent-templates/{filename}", get_single_agent_template, methods=["GET"]),
    Route("/api/default-template", get_default_template, methods=["GET"]),
    Route("/api/config/defaults", get_default_template, methods=["GET"]),
    Route("/api/models", get_owu_models, methods=["GET"]),
    Route("/api/owu/models", get_owu_models, methods=["GET"]),
    Route("/api/jobs", get_jobs, methods=["GET"]),
    Route("/api/v1/jobs", get_jobs, methods=["GET"]),
    Route("/api/jobs/clear", clear_jobs_api, methods=["POST", "DELETE"]),
    Route("/api/jobs/{job_uuid}/delete", delete_single_job_api, methods=["POST", "DELETE"]),
    Route("/api/jobs/{job_uuid}", get_job_by_uuid, methods=["GET"]),
    Route("/api/jobs/{job_uuid}", delete_single_job_api, methods=["DELETE"]),
    Route("/api/jobs/create", create_job, methods=["POST"]),
    Route("/api/jobs/provision", create_job, methods=["POST"]),
    Route("/api/jobs/{job_uuid}/events", job_events, methods=["GET"]),
    Route("/api/jobs/{job_uuid}/stream", job_events, methods=["GET"]),
    Route("/api/deployed-agents", get_deployed_agents_api, methods=["GET"]),
    Route("/api/deployed-agents/{job_uuid}/delete", delete_deployed_agent_api, methods=["POST"]),
    Route("/api/sandbox/requests", get_sandbox_requests, methods=["GET"]),
    Route("/api/sandbox/requests", create_sandbox_request, methods=["POST"]),
    Route("/api/sandbox/requests/{req_id}/approve", approve_sandbox_request, methods=["POST"]),
    Route("/api/sandbox/requests/{req_id}/reject", reject_sandbox_request, methods=["POST"]),
    Route("/api/sandbox/requests/{req_id}/deploy", deploy_sandbox_request, methods=["POST"]),
    Route("/api/v1/debug/system/status", lambda req: JSONResponse({"status": "ok", "system": "healthy"}), methods=["GET"])
]

# Mount React static assets if built
react_assets_dir = os.path.join(REACT_DIST_DIR, "assets")
if os.path.exists(react_assets_dir):
    routes.append(Mount("/assets", app=StaticFiles(directory=react_assets_dir), name="assets"))
    if APP_BASE_PATH:
        clean_base = APP_BASE_PATH.strip("/")
        routes.append(Mount(f"/{clean_base}/assets", app=StaticFiles(directory=react_assets_dir), name="subpath_assets"))

# If APP_BASE_PATH is configured (e.g. /sandbox), also register routes directly under that prefix
if APP_BASE_PATH:
    clean_base = APP_BASE_PATH.strip("/")
    routes.insert(0, Route(f"/{clean_base}", homepage))
    routes.insert(1, Route(f"/{clean_base}/", homepage))
    routes.insert(2, Route(f"/{clean_base}/request", request_form_page))
    routes.insert(3, Route(f"/{clean_base}/email-preview", email_preview_page))


middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
]

app = Starlette(routes=routes, middleware=middleware)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
