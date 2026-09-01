import os
import sys
import uuid
import json
import asyncio
import redis
import requests
from starlette.applications import Starlette
from starlette.responses import JSONResponse, HTMLResponse, StreamingResponse
from starlette.routing import Route

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
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
import open_webui.app.database as db
from open_webui.app.ldap_client import LDAPClient, sync_ldap_user_to_openwebui

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


async def homepage(request):
    """Serve the single page application interface."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    tmpl_path = os.path.join(base_dir, "templates", "index.html")
    with open(tmpl_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(html_content)


async def login_api(request):
    """Authenticate and verify the Open WebUI token."""
    try:
        body = await request.json()
        token = body.get("token")
        if not token:
            return JSONResponse({"detail": "Token is required"}, status_code=400)
            
        temp_client = OpenWebUIClient(OPENWEBUI_BASE_URL, token)
        user = temp_client.get_current_user()
        
        if user:
            return JSONResponse({"status": "success", "user": user})
        else:
            return JSONResponse({"detail": "Invalid session token"}, status_code=403)
    except Exception as e:
        return JSONResponse({"detail": f"Authentication failed: {str(e)}"}, status_code=401)


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
            AGENTS_DIR,
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "agents")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
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
                            templates.append({
                                "filename": f,
                                "id": data.get("id", f),
                                "name": data.get("name", f),
                                "base_model_id": data.get("base_model_id", "deepseek-v4-flash"),
                                "description": data.get("meta", {}).get("description", ""),
                                "tool_ids": data.get("meta", {}).get("toolIds", []),
                                "system_prompt": data.get("params", {}).get("system", ""),
                                "params": data.get("params", {}),
                                "valves": data.get("params", {}).get("valves", {})
                            })
                    except Exception as err:
                        print(f"[WARNING] Failed to parse template {fpath}: {err}")

        return JSONResponse(templates)
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


DEFAULT_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "default_template.json")


def load_default_template_data() -> dict:
    """Load default template constants from default_template.json with fallback defaults."""
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

    if os.path.exists(DEFAULT_TEMPLATE_PATH):
        try:
            with open(DEFAULT_TEMPLATE_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    return loaded
        except Exception as e:
            print(f"[WARNING] Failed to load {DEFAULT_TEMPLATE_PATH}: {e}")

    return fallback_defaults


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


async def create_job(request):
    """Accept target user and deployment configuration, create SQLite record, and queue job."""
    try:
        body = await request.json()
        
        # 1. Target User Section
        target_user = body.get("target_user") or {}
        user_id = target_user.get("id") or body.get("user_id")
        user_name = target_user.get("name") or body.get("user_name")
        user_email = target_user.get("email") or body.get("user_email")
        username = target_user.get("username") or body.get("username")
        
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
        
        # 2. PocketBase / Coolify Service Section
        pb_config = body.get("pocketbase") or body.get("coolify_service") or {}
        service_username = pb_config.get("username_prefix") or pb_config.get("username") or body.get("service_username")
        service_password = pb_config.get("admin_password") or pb_config.get("service_password") or body.get("service_password")
        admin_email = pb_config.get("admin_email") or body.get("admin_email")

        # 3. Open WebUI Agent Section
        owu_config = body.get("openwebui") or body.get("openwebui_agent") or {}
        template_name = owu_config.get("template_name") or body.get("template_name", "pocketbase_agent.json")
        agent_id = owu_config.get("agent_id") or body.get("agent_id")
        agent_name = owu_config.get("agent_name") or body.get("agent_name")
        system_prompt = owu_config.get("system_prompt") or body.get("system_prompt")
        base_model_id = owu_config.get("base_model_id") or body.get("base_model_id")
        tool_ids = owu_config.get("tool_ids") if owu_config.get("tool_ids") is not None else body.get("tool_ids")
        extra_params = owu_config.get("extra_params") or body.get("extra_params")
        access_grants = owu_config.get("access_grants") if owu_config.get("access_grants") is not None else body.get("access_grants", [])

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
                "template_name": template_name,
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
        
        return JSONResponse({"job_uuid": job_uuid, "status": "pending", "task_payload": task_payload})
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


routes = [
    Route("/", homepage),
    Route("/api/login", login_api, methods=["POST"]),
    Route("/api/users", get_users, methods=["GET"]),
    Route("/api/users/create", create_user_api, methods=["POST"]),
    Route("/api/ldap/users", get_ldap_users, methods=["GET"]),
    Route("/api/ldap/sync", sync_ldap_user, methods=["POST"]),
    Route("/api/agent-templates", get_agent_templates, methods=["GET"]),
    Route("/api/default-template", get_default_template, methods=["GET"]),
    Route("/api/config/defaults", get_default_template, methods=["GET"]),
    Route("/api/owu/models", get_owu_models, methods=["GET"]),
    Route("/api/jobs", get_jobs, methods=["GET"]),
    Route("/api/v1/jobs", get_jobs, methods=["GET"]),
    Route("/api/jobs/{job_uuid}", get_job_by_uuid, methods=["GET"]),
    Route("/api/jobs/create", create_job, methods=["POST"]),
    Route("/api/jobs/{job_uuid}/events", job_events, methods=["GET"]),
    Route("/api/v1/debug/system/status", lambda req: JSONResponse({"status": "ok", "system": "healthy"}), methods=["GET"])
]

app = Starlette(routes=routes)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
