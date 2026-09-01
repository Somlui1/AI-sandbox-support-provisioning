import os
import sys
import json
import time
import uuid
import re
import string
import secrets
import requests
from typing import Dict, Any, List, Optional
from InquirerPy import inquirer
from InquirerPy.base.control import Choice
from InquirerPy.separator import Separator
from rich.console import Console
from rich.panel import Panel
# Add parent folder to path to load local files
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from config import (
    COOLIFY_API_URL,
    COOLIFY_API_TOKEN,
    TARGET_PROJECT_UUID,
    TARGET_ENVIRONMENT_NAME,
    TARGET_SERVER_UUID,
    TARGET_DESTINATION_UUID,
    OPENWEBUI_BASE_URL,
    OPENWEBUI_ADMIN_TOKEN,
)
from coolify.client import CoolifyClient
from open_webui.client import OpenWebUIClient

# Tuning constants
INITIAL_BOOT_DELAY_SECONDS = 15
POLL_INTERVALS = [5, 5, 5, 10, 10, 10, 15, 15, 15, 20]
MAX_WAIT_SECONDS = 5 * 60  # 5 minutes
RUNNING_STATUSES = {"running", "healthy", "starting"}
FAILED_STATUSES  = {"error", "failed", "dead"}


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


def get_available_models(client: OpenWebUIClient) -> List[Dict[str, Any]]:
    """Fetch all available models directly from OpenWebUI API using client token."""
    url = f"{client.base_url}/api/models"
    try:
        resp = requests.get(url, headers=client.headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("data", [])
    except Exception as e:
        print(f"[WARNING] Failed to query available models: {e}")
    return []


def resolve_base_model(client: OpenWebUIClient) -> str:
    """Resolve base model ID. Prefers deepseek-v4-flash models, falls back to first available model."""
    models = get_available_models(client)
    if not models:
        print("[WARNING] No base models found in Open WebUI. Falling back to 'deepseek-v4-flash'.")
        return "deepseek-v4-flash"

    # Search for deepseek-v4-flash model
    for m in models:
        model_id = m.get("id", "")
        if "deepseek-v4-flash" in model_id.lower():
            print(f"[INFO] Found matching base model: {model_id}")
            return model_id

    # Fallback to first available
    fallback_model = models[0].get("id")
    print(f"[INFO] deepseek-v4-flash model not found. Using fallback model: {fallback_model}")
    return fallback_model


def verify_pb_auth(fqdn: str, pb_email: str, pb_password: str) -> tuple[bool, str, str]:
    """Verify admin auth on PocketBase v0.23+ and legacy endpoints."""
    endpoints = [
        (f"{fqdn}/api/collections/_superusers/auth-with-password", "v0.23+"),
        (f"{fqdn}/api/admins/auth-with-password",                   "legacy"),
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
                return True, f"Auth OK via {label} endpoint. Token valid ({col_count} collections).", token
            if resp.status_code == 404:
                continue
            return False, f"{label}: HTTP {resp.status_code} - {resp.text[:120]}", ""
        except requests.RequestException as e:
            continue

    return False, "All authentication endpoints failed.", ""




console = Console()

def select_user(
    openwebui_client: OpenWebUIClient,
    select_idx: Optional[int] = None,
    select_user_str: Optional[str] = None
) -> Dict[str, Any]:
    """Interactive fuzzy-search user selector with rich UX."""
    
    with console.status("[bold cyan]Fetching users from Open WebUI...", spinner="dots"):
        users = openwebui_client.get_users()

    if not users:
        console.print("[bold red]✖[/bold red] No users found or failed to fetch users from Open WebUI.")
        sys.exit(1)

    # 1. Direct Index Selection
    if select_idx is not None:
        if 1 <= select_idx <= len(users):
            selected = users[select_idx - 1]
            console.print(f"[green]✔[/green] Selected by index: [bold]{selected.get('name')}[/bold] ({selected.get('email')})")
            return selected
        console.print(f"[bold red]✖[/bold red] Pre-selected index {select_idx} is out of bounds (1-{len(users)}).")
        sys.exit(1)

    # 2. Direct String Match Selection
    if select_user_str is not None:
        term = select_user_str.strip().lower()
        for u in users:
            if term in {u.get("name", "").lower(), u.get("email", "").lower(), u.get("username", "").lower()} or term in u.get("email", "").lower():
                console.print(f"[green]✔[/green] Selected matching user: [bold]{u.get('name')}[/bold] ({u.get('email')})")
                return u
        console.print(f"[bold red]✖[/bold red] No user found matching: '{select_user_str}'.")
        sys.exit(1)

    # 3. Interactive Selection with Fuzzy Filtering
    choices = []
    for idx, user in enumerate(users, 1):
        name = user.get("name") or "Unknown"
        email = user.get("email") or "No Email"
        role = user.get("role", "user").upper()
        role_badge = f"[{role}]" if role == "ADMIN" else f"({role})"
        
        display_label = f"{idx:2d}. {name:<20} │ {email:<28} │ {role_badge}"
        choices.append(Choice(value=user, name=display_label))

    console.print(Panel(
        "[bold cyan]Open WebUI Agent Provisioning[/bold cyan]\n"
        "[dim]Use [bold]↑/↓[/bold] arrows to navigate, type to filter instantly, and press [bold]Enter[/bold] to select.[/dim]",
        border_style="cyan",
        padding=(1, 2)
    ))

    selected_user = inquirer.fuzzy(
        message="Select target user:",
        choices=choices,
        match_exact=False,
        border=True,
        pointer="❯",
        qmark="✦",
        amark="✔",
        instruction="[Type to search]",
    ).execute()

    if not selected_user:
        console.print("[yellow]Selection cancelled.[/yellow]")
        sys.exit(0)

    return selected_user


def deploy_pocketbase_with_rollback(
    coolify_client: CoolifyClient,
    cleaned_name: str,
    admin_email: str,
    admin_password: str
) -> Dict[str, Any]:
    """Deploy PocketBase to Coolify. Destroys the created service if deployment/verification fails."""
    service_uuid = None
    unique_id = cleaned_name
    service_name = f"pocketbase-{unique_id}"
    fqdn = f"http://pb-{unique_id}.10.10.3.111.sslip.io"

    # Read docker-compose template
    base_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(base_dir, "docker_compose_template.yml")
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Compose template not found at: {template_path}")

    with open(template_path, "r", encoding="utf-8") as f:
        compose_content = (
            f.read()
            .replace("${UNIQUE_ID}", unique_id)
            .replace("${PB_ADMIN_EMAIL}", admin_email)
            .replace("${PB_ADMIN_PASSWORD}", admin_password)
        )

    try:
        print(f"\n[2] Deploying service '{service_name}' on Coolify...")
        urls_mapping = [{"name": "pocketbase", "url": f"{fqdn}:8090"}]
        res = coolify_client.create_service(
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
        print(f"Service created successfully with UUID: {service_uuid}")

        # Start service (belt-and-suspenders over instant_deploy)
        try:
            coolify_client.start_service(service_uuid)
            print("Start service signal sent.")
        except Exception as e:
            print(f"[INFO] start_service trigger: {e}")

        # Phase 1: Wait for running status
        print(f"\nWaiting {INITIAL_BOOT_DELAY_SECONDS} seconds for container scheduling...")
        time.sleep(INITIAL_BOOT_DELAY_SECONDS)

        print("\nPhase 1: Waiting for container to reach running state...")
        deadline = time.time() + MAX_WAIT_SECONDS
        interval_idx = 0
        container_running = False

        while time.time() < deadline:
            try:
                details = coolify_client.get_service(service_uuid)
                svc_status = details.get("status", "")
                apps = details.get("applications", [])
                app_status = apps[0].get("status", "") if apps else ""
                print(f"  Coolify status: {svc_status!r} | App status: {app_status!r}")

                effective = app_status or svc_status
                if any(s in effective for s in RUNNING_STATUSES):
                    print("  -> Container is running!")
                    container_running = True
                    break
                if any(s in effective for s in FAILED_STATUSES):
                    raise Exception(f"Deployment failed on Coolify with status: {effective!r}")
            except Exception as e:
                if "Deployment failed" in str(e):
                    raise e
                print(f"  [WARNING] Error fetching status: {e}")

            interval = POLL_INTERVALS[min(interval_idx, len(POLL_INTERVALS) - 1)]
            interval_idx += 1
            time.sleep(interval)

        if not container_running:
            raise Exception(f"Container did not reach running state within {MAX_WAIT_SECONDS}s.")

        # Phase 2: Wait for /api/health
        health_url = f"{fqdn}/api/health"
        print(f"\nPhase 2: Waiting for PocketBase health endpoint {health_url}...")
        interval_idx = 0
        health_ok = False

        while time.time() < deadline:
            try:
                resp = requests.get(health_url, timeout=5)
                print(f"  /api/health -> HTTP {resp.status_code}")
                if resp.status_code == 200:
                    health_ok = True
                    break
            except requests.RequestException as e:
                print(f"  [WAITING] Health check connection error: {type(e).__name__}")

            interval = POLL_INTERVALS[min(interval_idx, len(POLL_INTERVALS) - 1)]
            interval_idx += 1
            time.sleep(interval)

        if not health_ok:
            raise Exception("PocketBase health check endpoint (/api/health) timed out.")

        # Phase 3: Verify admin authentication
        print("\nPhase 3: Verifying admin credentials and authentication token...")
        auth_ok, auth_msg, token = verify_pb_auth(fqdn, admin_email, admin_password)
        if not auth_ok:
            raise Exception(f"Credentials verification failed: {auth_msg}")
        print(f"  [SUCCESS] {auth_msg}")

        return {
            "service_uuid": service_uuid,
            "fqdn": fqdn,
            "token": token
        }

    except Exception as e:
        print(f"\n[ERROR] Deployment failed: {e}")
        if service_uuid:
            print(f"!!! ROLLBACK INITIALIZED !!! Deleting service '{service_name}' (UUID: {service_uuid}) from Coolify...")
            try:
                coolify_client.delete_service(service_uuid)
                print("Rollback successful. Service deleted from Coolify.")
            except Exception as del_err:
                print(f"[ERROR] Failed to delete service during rollback: {del_err}")
        sys.exit(1)


def create_openwebui_agent(
    openwebui_client: OpenWebUIClient,
    selected_user: Dict[str, Any],
    admin_user: Dict[str, Any],
    fqdn: str,
    admin_email: str,
    admin_password: str
) -> Dict[str, Any]:
    """Create or update Agent on OpenWebUI with target valves and access grants."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    agent_json_path = os.path.join(base_dir, "pocketbase_agent.json")
    if not os.path.exists(agent_json_path):
        agent_json_path = os.path.join(base_dir, "agents", "pocketbase_agent.json")
    if not os.path.exists(agent_json_path):
        raise FileNotFoundError(f"Agent JSON template not found at: {agent_json_path}")

    with open(agent_json_path, "r", encoding="utf-8") as f:
        agent_data = json.load(f)

    # Determine username clean name
    username = selected_user.get("username") or selected_user.get("name", "user")
    cleaned_username = clean_username(username)

    # Resolve base model ID
    base_model = resolve_base_model(openwebui_client)

    # Override values
    agent_data["id"] = f"pocketbase-agent-{cleaned_username}"
    agent_data["name"] = f"PocketBase Agent - {selected_user.get('name')}"
    agent_data["base_model_id"] = base_model

    # Configure valves
    valves = agent_data.setdefault("params", {}).setdefault("valves", {})
    pb_valves = valves.setdefault("pocketbase", {})
    pb_valves["POCKETBASE_URL"] = fqdn
    pb_valves["POCKETBASE_ADMIN_EMAIL"] = admin_email
    pb_valves["POCKETBASE_ADMIN_PASSWORD"] = admin_password

    # Configure access grants: Selected user & Admin user get read/write
    agent_data["access_grants"] = [
        {
            "principal_type": "user",
            "principal_id": selected_user["id"],
            "permission": "read"
        },
        {
            "principal_type": "user",
            "principal_id": selected_user["id"],
            "permission": "write"
        },
        {
            "principal_type": "user",
            "principal_id": admin_user["id"],
            "permission": "read"
        },
        {
            "principal_type": "user",
            "principal_id": admin_user["id"],
            "permission": "write"
        }
    ]

    print(f"\n[3] Registering Agent '{agent_data['id']}' in Open WebUI...")
    try:
        # Attempt to create the model
        res = openwebui_client.create_model(agent_data)
        return res
    except Exception as e:
        print(f"[INFO] create_model failed or model already exists. Trying update_model... Details: {e}")
        try:
            res = openwebui_client.update_model(agent_data)
            return res
        except Exception as e_up:
            raise Exception(f"Failed to create or update Open WebUI model: {e_up}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="PocketBase Service & Agent Provisioning CLI")
    parser.add_argument("--select", type=int, help="Pre-select target user by 1-based index.")
    parser.add_argument("--user", type=str, help="Pre-select target user by username or email.")
    args = parser.parse_args()

    print("=" * 80)
    print("           POCKETBASE SERVICE & AGENT PROVISIONING CLI")
    print("=" * 80)

    # Instantiate clients
    coolify = CoolifyClient(COOLIFY_API_URL, COOLIFY_API_TOKEN, verbose=False)
    openwebui = OpenWebUIClient(OPENWEBUI_BASE_URL, OPENWEBUI_ADMIN_TOKEN)

    # 1. Interactive selection of target user
    selected_user = select_user(openwebui, select_idx=args.select, select_user_str=args.user)
    print(f"\nSelected Target User: {selected_user.get('name')} (UUID: {selected_user.get('id')})")

    # Get current session admin user (manager of the agent)
    try:
        admin_user = openwebui.get_current_user()
        print(f"Logged in Admin:      {admin_user.get('name')} (UUID: {admin_user.get('id')})")
    except Exception as e:
        print(f"[ERROR] Failed to fetch current admin session: {e}")
        sys.exit(1)

    # Generate credentials & unique names
    username = selected_user.get("username") or selected_user.get("name", "user")
    cleaned_name = clean_username(username)
    admin_email = f"admin@{cleaned_name}.local"
    admin_password = generate_random_password()

    # 2. Deploy PocketBase to Coolify with auto-rollback
    deploy_info = deploy_pocketbase_with_rollback(
        coolify_client=coolify,
        cleaned_name=cleaned_name,
        admin_email=admin_email,
        admin_password=admin_password
    )

    # 3. Create/Register OpenWebUI Agent
    try:
        agent_res = create_openwebui_agent(
            openwebui_client=openwebui,
            selected_user=selected_user,
            admin_user=admin_user,
            fqdn=deploy_info["fqdn"],
            admin_email=admin_email,
            admin_password=admin_password
        )
        print("\n[SUCCESS] Agent registered successfully in Open WebUI!")
    except Exception as e:
        print(f"\n[ERROR] Open WebUI Agent creation failed: {e}")
        print("!!! ROLLBACK INITIALIZED !!! Deleting Coolify service due to post-deploy registration failure...")
        try:
            coolify.delete_service(deploy_info["service_uuid"])
            print("Rollback successful. Coolify service deleted.")
        except Exception as del_err:
            print(f"[ERROR] Failed to delete service during rollback: {del_err}")
        sys.exit(1)

    # Summary
    print("\n" + "=" * 80)
    print("  PROVISIONING COMPLETED SUCCESSFULLY!")
    print("=" * 80)
    print(f"Target User   : {selected_user.get('name')} (Email: {selected_user.get('email')})")
    print(f"PocketBase FQDN : {deploy_info['fqdn']}")
    print(f"Admin Email   : {admin_email}")
    print(f"Admin Password: {admin_password}")
    print(f"PocketBase UI   : {deploy_info['fqdn']}/_/")
    print(f"OpenWebUI Agent : {agent_res.get('id') or f'pocketbase-agent-{cleaned_name}'}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
