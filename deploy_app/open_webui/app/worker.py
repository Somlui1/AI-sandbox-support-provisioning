import os
import sys
import json
import time
import re
import string
import secrets
import redis
import requests
from typing import Dict, Any, Optional

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add parent directory to path to load packages
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from coolify.client import CoolifyClient
from open_webui.client import OpenWebUIClient
from open_webui.app.settings import (
    COOLIFY_API_URL, COOLIFY_API_TOKEN,
    TARGET_PROJECT_UUID, TARGET_ENVIRONMENT_NAME,
    TARGET_SERVER_UUID, TARGET_DESTINATION_UUID,
    OPENWEBUI_BASE_URL, OPENWEBUI_ADMIN_TOKEN,
    REDIS_URL, REDIS_QUEUE_NAME, get_redis_client,
    AGENTS_DIR, LDAP_DOMAIN
)
import open_webui.app.core.database as db
from open_webui.app.core.ldap_client import sync_ldap_user_to_openwebui
from open_webui.app.core.prompt_utils import load_system_prompt_template, interpolate_prompt_variables

# Tuning parameters for polling
INITIAL_BOOT_DELAY_SECONDS = 15
POLL_INTERVALS = [5, 5, 5, 10, 10, 10, 15, 15, 15, 20]
MAX_WAIT_SECONDS = 300
RUNNING_STATUSES = {"running", "healthy", "starting"}
FAILED_STATUSES = {"error", "failed", "dead"}


def clean_username(name: str) -> str:
    """Clean username to keep only alphanumeric characters for subdomains."""
    cleaned = re.sub(r'[^a-zA-Z0-9]', '', name).lower()
    if not cleaned:
        cleaned = "agentuser"
    return cleaned[:20]


def generate_random_password(length: int = 12) -> str:
    """Generate a secure random alphanumeric password."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def get_available_models(client: OpenWebUIClient) -> list:
    """Fetch all available models directly from OpenWebUI API."""
    url = f"{client.base_url}/api/models"
    try:
        resp = requests.get(url, headers=client.headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("data", [])
    except Exception as e:
        print(f"[WARNING] Failed to query available models: {e}")
    return []


def resolve_base_model(client: OpenWebUIClient) -> str:
    """Resolve base model ID. Prefers Qwen models, falls back to first available model."""
    models = get_available_models(client)
    if not models:
        return "Qwen"
    # Search for Qwen model
    for m in models:
        model_id = m.get("id", "")
        if "qwen" in model_id.lower():
            return model_id
    return models[0].get("id")


def verify_pb_auth(fqdn: str, pb_email: str, pb_password: str) -> tuple[bool, str]:
    """Verify admin auth on PocketBase v0.23+ and legacy endpoints."""
    endpoints = [
        (f"{fqdn}/api/collections/_superusers/auth-with-password", "v0.23+"),
        (f"{fqdn}/api/admins/auth-with-password", "legacy"),
    ]
    for url, label in endpoints:
        try:
            resp = requests.post(
                url,
                json={"identity": pb_email, "password": pb_password},
                timeout=8,
            )
            if resp.status_code == 200:
                token = resp.json().get("token", "")
                # Confirm token works
                headers = {"Authorization": f"Bearer {token}"}
                col_resp = requests.get(f"{fqdn}/api/collections", headers=headers, timeout=8)
                col_count = len(col_resp.json().get("items", [])) if col_resp.status_code == 200 else "?"
                return True, f"Auth OK via {label} endpoint. Token valid ({col_count} collections)."
            if resp.status_code == 404:
                continue
            return False, f"{label}: HTTP {resp.status_code} - {resp.text[:120]}"
        except requests.RequestException:
            continue
    return False, "All authentication endpoints failed."


class JobWorker:
    def __init__(self):
        db.run_migrations()
        self.redis_client = get_redis_client()
        # Instantiate clients with verbose logging off to avoid cluttering worker output
        self.coolify = CoolifyClient(COOLIFY_API_URL, COOLIFY_API_TOKEN, verbose=False)
        self.openwebui = OpenWebUIClient(OPENWEBUI_BASE_URL, OPENWEBUI_ADMIN_TOKEN)
        print("Worker initialized. Listening for jobs...")

    def publish_progress(self, job_uuid: str, step_name: str, status: str, detail: Optional[str] = None):
        """Update job steps in SQLite database, print structured console log, and publish to Redis Pub/Sub."""
        steps = db.add_job_step(job_uuid, step_name, status, detail)
        user_info = getattr(self, "current_user_info", "Target User")
        
        # Status badge indicator
        if status == "completed":
            badge = "[OK COMPLETED]"
        elif status == "failed":
            badge = "[FAIL FAILED  ]"
        else:
            badge = "[.. RUNNING  ]"

        step_idx = len(steps)
        print(f"[WORKER] {badge} [User: {user_info}] (Step {step_idx}) {step_name} -> {detail or ''}", flush=True)

        payload = {
            "job_uuid": job_uuid,
            "user_info": user_info,
            "step_name": step_name,
            "status": status,
            "detail": detail or "",
            "steps": steps
        }
        self.redis_client.publish(f"job_progress:{job_uuid}", json.dumps(payload))

    def execute_job(self, job_data: Dict[str, Any]):
        job_uuid = job_data["job_uuid"]
        
        # 1. Unpack Target User Details
        target_user = job_data.get("target_user") or {}
        user_id = target_user.get("id") or job_data.get("user_id")
        user_name = target_user.get("name") or job_data.get("user_name") or "Unknown"
        user_email = target_user.get("email") or job_data.get("user_email") or ""
        username = target_user.get("username") or job_data.get("username")
        sam_account = target_user.get("sAMAccountName") or target_user.get("username") or username or clean_username(user_name or user_email)

        self.current_user_info = f"{sam_account} ({user_email})" if user_email else sam_account
        print(f"\n" + "=" * 75, flush=True)
        print(f"[WORKER] >>> STARTING JOB for User: {self.current_user_info} | Job UUID: {job_uuid}", flush=True)
        print("=" * 75, flush=True)

        db.update_job_status(job_uuid, "running")

        # Resolve OpenWebUI client for this job
        owu_config = job_data.get("openwebui") or job_data.get("openwebui_agent") or {}
        owu_token = owu_config.get("openwebui_token") or job_data.get("openwebui_token") or OPENWEBUI_ADMIN_TOKEN
        owu_client = OpenWebUIClient(OPENWEBUI_BASE_URL, owu_token)

        # Guarantee User is Synced to Open WebUI to obtain UUID for permission grants
        standard_domain = LDAP_DOMAIN or "aapico.com"
        standard_email = f"{sam_account}@{standard_domain}".lower()

        if not user_id and standard_email:
            self.publish_progress(job_uuid, "Syncing User to Open WebUI", "running", f"Auto-syncing LDAP user '{standard_email}' to Open WebUI to obtain UUID.")
            try:
                sync_res = sync_ldap_user_to_openwebui({
                    "username": sam_account,
                    "sAMAccountName": sam_account,
                    "name": sam_account,
                    "email": standard_email
                }, owu_client)
                user_id = sync_res.get("user", {}).get("id")
                if not user_id:
                    raise RuntimeError(f"User sync completed but no Open WebUI UUID was returned: {sync_res}")
                self.publish_progress(job_uuid, "Syncing User to Open WebUI", "completed", f"User synced with Open WebUI UUID: {user_id}")
            except Exception as e:
                self.publish_progress(job_uuid, "Syncing User to Open WebUI", "failed", f"Failed to sync user: {e}")
                raise

        self.publish_progress(job_uuid, "Initializing", "running", "Generating credentials and configuration templates.")

        service_uuid = None
        service_name = None
        fqdn = None

        try:
            # 2. Unpack PocketBase / Coolify Service Details
            pb_config = job_data.get("pocketbase") or job_data.get("coolify_service") or {}
            raw_username = pb_config.get("username_prefix") or pb_config.get("username") or job_data.get("service_username") or user_name or user_email
            cleaned_name = clean_username(raw_username)
            service_name = f"pocketbase-{cleaned_name}"
            fqdn = pb_config.get("fqdn") or pb_config.get("pocketbase_url") or f"http://pb-{cleaned_name}.10.10.3.111.sslip.io"
            
            # Default email to username@domain
            default_domain = LDAP_DOMAIN or "aapico.com"
            default_email = f"{cleaned_name}@{default_domain}"
            admin_email = pb_config.get("admin_email") or job_data.get("admin_email") or default_email
            admin_password = pb_config.get("admin_password") or job_data.get("service_password") or generate_random_password()

            db.update_job_status(job_uuid, "running", service_name=service_name, fqdn=fqdn)
            self.publish_progress(
                job_uuid,
                "Initializing",
                "completed",
                f"Credentials configured. Service: {service_name}, FQDN: {fqdn}, Admin: {admin_email}"
            )

            # 2. Deploy service on Coolify
            self.publish_progress(job_uuid, "Deploying PocketBase", "running", "Creating service on Coolify.")
            base_dir = os.path.dirname(os.path.abspath(__file__))
            template_path = os.path.join(base_dir, "..", "..", "docker_compose_template.yml")
            if not os.path.exists(template_path):
                raise FileNotFoundError(f"Docker compose template not found at {template_path}")

            with open(template_path, "r", encoding="utf-8") as f:
                compose_content = (
                    f.read()
                    .replace("${UNIQUE_ID}", cleaned_name)
                    .replace("${PB_ADMIN_EMAIL}", admin_email)
                    .replace("${PB_ADMIN_PASSWORD}", admin_password)
                )

            urls_mapping = [{"name": "pocketbase", "url": f"{fqdn}:8090"}]
            res = self.coolify.create_service(
                name=service_name,
                project_uuid=TARGET_PROJECT_UUID,
                environment_name=TARGET_ENVIRONMENT_NAME,
                server_uuid=TARGET_SERVER_UUID,
                docker_compose_content=compose_content,
                destination_uuid=TARGET_DESTINATION_UUID,
                urls=urls_mapping,
                instant_deploy=True
            )
            service_uuid = res.get("uuid")
            if not service_uuid:
                raise Exception("Failed to retrieve service UUID from Coolify response.")

            # Save the service UUID immediately for rollback purposes
            # (stored in error_message or we can assume clean up by service name)
            self.publish_progress(
                job_uuid,
                "Deploying PocketBase",
                "completed",
                f"Service created with UUID: {service_uuid}. Deploy triggered."
            )

            # 3. Wait for running status
            self.publish_progress(
                job_uuid,
                "Waiting for Container",
                "running",
                f"Waiting {INITIAL_BOOT_DELAY_SECONDS}s for Docker scheduler."
            )
            time.sleep(INITIAL_BOOT_DELAY_SECONDS)

            deadline = time.time() + MAX_WAIT_SECONDS
            interval_idx = 0
            container_running = False

            while time.time() < deadline:
                try:
                    details = self.coolify.get_service(service_uuid)
                    svc_status = details.get("status", "")
                    apps = details.get("applications", [])
                    app_status = apps[0].get("status", "") if apps else ""
                    
                    self.publish_progress(
                        job_uuid,
                        "Waiting for Container",
                        "running",
                        f"Coolify: {svc_status} | App: {app_status}"
                    )

                    effective = app_status or svc_status
                    if any(s in effective for s in RUNNING_STATUSES):
                        container_running = True
                        break
                    if any(s in effective for s in FAILED_STATUSES):
                        raise Exception(f"Container deployment failed with status: {effective}")
                except Exception as e:
                    if "deployment failed" in str(e).lower():
                        raise e
                    # Ignore transient status check errors

                interval = POLL_INTERVALS[min(interval_idx, len(POLL_INTERVALS) - 1)]
                interval_idx += 1
                time.sleep(interval)

            if not container_running:
                raise TimeoutError("Container failed to reach running state within timeout limit.")

            self.publish_progress(job_uuid, "Waiting for Container", "completed", "Container is running.")

            # 4. Wait for /api/health
            self.publish_progress(job_uuid, "Checking Health", "running", "Waiting for health check endpoint.")
            health_url = f"{fqdn}/api/health"
            interval_idx = 0
            health_ok = False

            while time.time() < deadline:
                try:
                    resp = requests.get(health_url, timeout=5)
                    if resp.status_code == 200:
                        health_ok = True
                        break
                except requests.RequestException:
                    pass

                interval = POLL_INTERVALS[min(interval_idx, len(POLL_INTERVALS) - 1)]
                interval_idx += 1
                time.sleep(interval)

            if not health_ok:
                raise Exception("Health check endpoint timed out.")

            self.publish_progress(job_uuid, "Checking Health", "completed", "Health check OK.")

            # 5. Verify Admin Auth
            self.publish_progress(job_uuid, "Verifying Admin", "running", "Checking admin authorization credentials.")
            auth_ok, auth_msg = verify_pb_auth(fqdn, admin_email, admin_password)
            if not auth_ok:
                raise Exception(f"Credentials validation failed: {auth_msg}")

            self.publish_progress(job_uuid, "Verifying Admin", "completed", f"Admin verified successfully. {auth_msg}")

            # 6. Register Agent on Open WebUI
            self.publish_progress(job_uuid, "Registering Agent", "running", "Creating custom Open WebUI agent model.")
            
            # Unpack Open WebUI Agent Section
            owu_config = job_data.get("openwebui") or job_data.get("openwebui_agent") or {}

            # Locate agent template json
            template_filename = owu_config.get("template_name") or job_data.get("template_name") or "pocketbase_agent.json"
            candidate_paths = [
                os.path.join(base_dir, "templates", "agents", template_filename),
                os.path.join(base_dir, "templates", template_filename),
                os.path.join(AGENTS_DIR, template_filename),
                os.path.join(base_dir, "..", "..", "agents", template_filename),
                os.path.join(base_dir, "..", "..", template_filename),
                os.path.join(base_dir, template_filename),
            ]
            
            agent_json_path = None
            for cp in candidate_paths:
                if os.path.exists(cp):
                    agent_json_path = cp
                    break

            if not agent_json_path:
                raise FileNotFoundError(f"Agent template '{template_filename}' not found in candidate paths.")

            with open(agent_json_path, "r", encoding="utf-8") as f:
                agent_data = json.load(f)

            # Apply custom agent naming or defaults
            custom_agent_id = owu_config.get("agent_id") or job_data.get("agent_id") or f"pocketbase-agent-{cleaned_name}"
            custom_agent_name = owu_config.get("agent_name") or job_data.get("agent_name") or f"PocketBase Agent - {user_name}"
            base_model = owu_config.get("base_model_id") or job_data.get("base_model_id") or resolve_base_model(owu_client)
            
            agent_data["id"] = custom_agent_id
            agent_data["name"] = custom_agent_name
            agent_data["base_model_id"] = base_model

            # System prompt resolution with template fallback and dynamic placeholder interpolation
            sys_prompt = owu_config.get("system_prompt") or job_data.get("system_prompt")
            sys_prompt_file = owu_config.get("system_prompt_file") or job_data.get("system_prompt_file") or "system_prompt.md"

            if not sys_prompt and sys_prompt_file:
                sys_prompt = load_system_prompt_template(sys_prompt_file)

            if not sys_prompt:
                sys_prompt = agent_data.get("params", {}).get("system", "")

            prompt_context = {
                "pocketbase_url": fqdn,
                "fqdn": fqdn,
                "username": cleaned_name,
                "user_name": user_name,
                "user_email": user_email,
                "admin_email": admin_email,
                "service_name": service_name,
            }

            if sys_prompt:
                final_sys_prompt = interpolate_prompt_variables(sys_prompt, prompt_context)
                agent_data.setdefault("params", {})["system"] = final_sys_prompt

            # Tools override if provided
            tools = owu_config.get("tool_ids") if owu_config.get("tool_ids") is not None else job_data.get("tool_ids")
            if tools is not None:
                meta = agent_data.setdefault("meta", {})
                meta["toolIds"] = tools

            # Extra params merge if provided
            extra = owu_config.get("extra_params") or job_data.get("extra_params")
            if extra and isinstance(extra, dict):
                for k, v in extra.items():
                    agent_data.setdefault("params", {})[k] = v

            # Configure valves with service credentials
            valves = agent_data.setdefault("params", {}).setdefault("valves", {})
            pb_valves = valves.setdefault("pocketbase", {})
            pb_valves["POCKETBASE_URL"] = fqdn
            pb_valves["POCKETBASE_ADMIN_EMAIL"] = admin_email
            pb_valves["POCKETBASE_ADMIN_PASSWORD"] = admin_password

            # Configure access grants (selected user and admin session + any additional user grants)
            current_admin = None
            try:
                current_admin = owu_client.get_current_user()
            except Exception as e_admin:
                print(f"[WARNING] Could not fetch current admin user from Open WebUI session: {e_admin}")

            grants = []
            seen_grants = set()

            def add_grant(principal_type: str, principal_id: str, permission: str):
                if not principal_id or not permission:
                    return
                key = (principal_type, str(principal_id), permission.lower())
                if key not in seen_grants:
                    seen_grants.add(key)
                    grants.append({
                        "principal_type": principal_type,
                        "principal_id": str(principal_id),
                        "permission": permission.lower()
                    })

            # Guaranteed default: target user has read & write
            add_grant("user", user_id, "read")
            add_grant("user", user_id, "write")

            # Guaranteed default: current admin has read & write
            if current_admin and current_admin.get("id"):
                add_grant("user", current_admin["id"], "read")
                add_grant("user", current_admin["id"], "write")

            # Add any custom access grants from job payload
            custom_grants = owu_config.get("access_grants") if owu_config.get("access_grants") is not None else job_data.get("access_grants")
            if isinstance(custom_grants, list):
                for g in custom_grants:
                    pid = g.get("principal_id") or g.get("user_id")
                    ptype = g.get("principal_type", "user")
                    perm = g.get("permission", "read")
                    add_grant(ptype, pid, perm)

            agent_data["access_grants"] = grants

            try:
                owu_client.create_model(agent_data)
            except Exception as e_create:
                print(f"[INFO] Create model failed, attempting update. Details: {e_create}")
                owu_client.update_model(agent_data)

            self.publish_progress(
                job_uuid,
                "Registering Agent",
                "completed",
                f"Agent registered in Open WebUI. Model ID: {agent_data['id']}"
            )

            # Success
            db.update_job_status(job_uuid, "completed")
            print(f"\n[WORKER] SUCCESS: ALL 6 STEPS COMPLETED FOR USER: {self.current_user_info}!")
            print(f"[WORKER]    PocketBase FQDN : {fqdn}")
            print(f"[WORKER]    Open WebUI Model: {agent_data['id']}")
            print("=" * 75 + "\n", flush=True)

            # Publish terminal finished message
            self.redis_client.publish(f"job_progress:{job_uuid}", json.dumps({
                "job_uuid": job_uuid,
                "user_info": self.current_user_info,
                "status": "completed",
                "detail": "Provisioning process completed successfully.",
                "steps": db.get_job(job_uuid)["steps"]
            }))

        except Exception as err:
            print(f"[ERROR] Job failed: {err}")
            db.update_job_status(job_uuid, "failed", error_message=str(err))
            self.publish_progress(job_uuid, "Failure", "failed", f"Execution failed: {err}")

            # Rollback: delete Coolify service if it was created
            if service_uuid:
                self.publish_progress(job_uuid, "Rollback", "running", f"Initiating rollback. Deleting service UUID {service_uuid}")
                try:
                    self.coolify.delete_service(service_uuid)
                    self.publish_progress(job_uuid, "Rollback", "completed", "Rollback successful. Coolify service deleted.")
                except Exception as rollback_err:
                    self.publish_progress(job_uuid, "Rollback", "failed", f"Rollback failed: {rollback_err}")
            
            # Publish terminal failed message
            self.redis_client.publish(f"job_progress:{job_uuid}", json.dumps({
                "job_uuid": job_uuid,
                "status": "failed",
                "detail": f"Provisioning process failed. {err}",
                "steps": db.get_job(job_uuid)["steps"]
            }))

    def run(self):
        while True:
            try:
                # Blocking pop from Redis list queue
                res = self.redis_client.blpop(REDIS_QUEUE_NAME, timeout=10)
                if res:
                    queue_name, payload_str = res
                    job_data = json.loads(payload_str)
                    print(f"Popped job: {job_data['job_uuid']}")
                    self.execute_job(job_data)
            except redis.exceptions.ConnectionError:
                print("[WARNING] Redis Connection lost. Retrying in 5 seconds...")
                time.sleep(5)
            except KeyboardInterrupt:
                print("Worker shutting down.")
                break
            except Exception as e:
                print(f"[ERROR] Worker error: {e}")


if __name__ == "__main__":
    worker = JobWorker()
    worker.run()
