import base64
import requests
import json
import time
import uuid
import secrets
import string
from typing import Dict, Any, List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

class CoolifyClient:
    def __init__(self, base_url: str, token: str, verbose: bool = True):
        """
        Initialize the Coolify API Client.
        
        :param base_url: The base URL of the Coolify API, e.g., http://10.10.3.222:8000/api/v1
        :param token: Sanctum API Token
        :param verbose: Whether to print verbose HTTP request/response details
        """
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.verbose = verbose
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def _request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Helper to send HTTP requests to the Coolify API with optional Postman-style logging."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Mask Authorization header for security in console output
        logged_headers = self.headers.copy()
        if "Authorization" in logged_headers:
            auth_val = logged_headers["Authorization"]
            if auth_val.startswith("Bearer ") and len(auth_val) > 25:
                logged_headers["Authorization"] = f"{auth_val[:15]}...{auth_val[-10:]}"
                
        # 1. Print Request Details (Postman Style)
        if self.verbose:
            print("\n" + "="*80)
            print(f" >>> REQUEST: {method} {url}")
            print("="*80)
            print("HEADERS:")
            for k, v in logged_headers.items():
                print(f"  {k}: {v}")
            if params:
                print(f"QUERY PARAMETERS:\n  {json.dumps(params, indent=2)}")
            if data:
                print("BODY (application/json):")
                print(json.dumps(data, indent=2))
            print("="*80)
        
        try:
            start_time = time.time()
            response = requests.request(method, url, headers=self.headers, json=data, params=params, timeout=15)
            elapsed_ms = (time.time() - start_time) * 1000
            
            # 2. Print Response Details (Postman Style)
            if self.verbose:
                print("\n" + "="*80)
                print(f" <<< RESPONSE: {response.status_code} {response.reason} | Time: {elapsed_ms:.1f}ms")
                print("="*80)
                print("HEADERS:")
                for k, v in response.headers.items():
                    print(f"  {k}: {v}")
            
            # For DELETE or responses without content returning 200/204
            if response.status_code == 204 or (response.status_code == 200 and not response.text):
                res_data = {"success": True, "status_code": response.status_code}
                if self.verbose:
                    print("BODY (JSON):\n  (No content returned)")
                    print("="*80)
                return res_data
                
            response.raise_for_status()
            res_json = response.json()
            if self.verbose:
                print("BODY (JSON):")
                print(json.dumps(res_json, indent=2))
                print("="*80)
            return res_json
        except requests.exceptions.JSONDecodeError:
            if self.verbose:
                print(f"BODY (RAW):\n{response.text[:500]}...")
                print("="*80)
            raise Exception(
                f"Failed to decode JSON response from Coolify API (URL: {url}). "
                f"Response body: {response.text[:200]}"
            )
        except requests.HTTPError as http_err:
            try:
                err_detail = response.json()
            except ValueError:
                err_detail = response.text
            if self.verbose:
                print(f"BODY (ERROR):\n{err_detail}")
                print("="*80)
            raise Exception(f"HTTP error occurred: {http_err} - Details: {err_detail}")
        except Exception as err:
            if self.verbose:
                print(f"ERROR: {err}")
                print("="*80)
            raise err

    # Project & Environment APIs
    def get_projects(self) -> List[Dict[str, Any]]:
        """List all projects."""
        return self._request("GET", "projects")

    def create_project(self, name: str, description: Optional[str] = None) -> Dict[str, Any]:
        """Create a new project."""
        payload = {"name": name}
        if description:
            payload["description"] = description
        return self._request("POST", "projects", data=payload)

    def delete_project(self, project_uuid: str) -> Dict[str, Any]:
        """Delete a project by UUID."""
        return self._request("DELETE", f"projects/{project_uuid}")

    def get_environments(self, project_uuid: str) -> List[Dict[str, Any]]:
        """List environments for a specific project."""
        return self._request("GET", f"projects/{project_uuid}/environments")

    def get_project(self, project_uuid: str) -> Dict[str, Any]:
        """Get project details including environments."""
        return self._request("GET", f"projects/{project_uuid}")

    def get_services(self) -> List[Dict[str, Any]]:
        """List all services."""
        return self._request("GET", "services")

    def get_applications(self) -> List[Dict[str, Any]]:
        """List all applications."""
        return self._request("GET", "applications")

    def get_databases(self) -> List[Dict[str, Any]]:
        """List all databases."""
        return self._request("GET", "databases")

    # Server & Destination APIs
    def get_servers(self) -> List[Dict[str, Any]]:
        """List all servers."""
        return self._request("GET", "servers")

    def get_server(self, server_uuid: str) -> Dict[str, Any]:
        """Get details for a single server."""
        return self._request("GET", f"servers/{server_uuid}")

    def get_server_destinations(self, server_uuid: str) -> List[Dict[str, Any]]:
        """List Docker destinations for a server."""
        return self._request("GET", f"servers/{server_uuid}/destinations")

    # Service (Docker Compose Stack) APIs
    def create_service(
        self,
        name: str,
        project_uuid: str,
        environment_name: str,
        server_uuid: str,
        docker_compose_content: str,
        destination_uuid: Optional[str] = None,
        urls: Optional[List[Dict[str, str]]] = None,
        instant_deploy: bool = True
    ) -> Dict[str, Any]:
        """
        Create a new service from raw docker-compose file content.
        
        :param name: Name of the service
        :param project_uuid: Target Project UUID
        :param environment_name: Target Environment name (e.g. 'production')
        :param server_uuid: Target Server UUID
        :param docker_compose_content: Raw docker-compose YAML string
        :param destination_uuid: Target Destination UUID (optional if server has only 1 destination)
        :param urls: Optional list of URLs mapping to containers, e.g. [{"name": "web", "url": "http://my-web-app.com"}]
        :param instant_deploy: Whether to deploy immediately after creation
        :return: JSON dict containing service UUID and domain configurations
        """
        # Base64 encode the docker-compose YAML
        compose_bytes = docker_compose_content.encode("utf-8")
        b64_compose = base64.b64encode(compose_bytes).decode("utf-8")

        payload = {
            "name": name,
            "project_uuid": project_uuid,
            "environment_name": environment_name,
            "server_uuid": server_uuid,
            "docker_compose_raw": b64_compose,
            "instant_deploy": instant_deploy,
            "force_domain_override": True
        }

        if destination_uuid:
            payload["destination_uuid"] = destination_uuid
        if urls:
            payload["urls"] = urls

        return self._request("POST", "services", data=payload, params={"force_domain_override": "1"})

    def get_service(self, service_uuid: str) -> Dict[str, Any]:
        """Get full details of a service stack by UUID."""
        return self._request("GET", f"services/{service_uuid}")

    def get_service_applications(self, service_uuid: str) -> List[Dict[str, Any]]:
        """List application components of a service stack."""
        return self._request("GET", f"services/{service_uuid}/applications")

    def start_service(self, service_uuid: str) -> Dict[str, Any]:
        """Start/Deploy a service stack."""
        return self._request("POST", f"services/{service_uuid}/start")

    def stop_service(self, service_uuid: str) -> Dict[str, Any]:
        """Stop a running service stack."""
        return self._request("POST", f"services/{service_uuid}/stop")

    def delete_service(self, service_uuid: str) -> Dict[str, Any]:
        """Delete a service stack (removes configuration and stops containers)."""
        return self._request("DELETE", f"services/{service_uuid}")

    def delete_all_services(self, project_uuid: str, env_name: str) -> Dict[str, Any]:
        """Delete all services in a specific project and environment."""
        # 1. Get project details to find the correct environment ID
        project = self.get_project(project_uuid)
        environments = project.get("environments", [])
        
        env_id = None
        for env in environments:
            if env.get("name") == env_name:
                env_id = env.get("id")
                break
                
        if env_id is None:
            raise Exception(f"Environment '{env_name}' not found in project '{project_uuid}'.")
            
        # 2. Fetch all services
        services = self.get_services()
        results = []
        for service in services:
            uuid = service.get("uuid")
            name = service.get("name")
            
            # Match service's environment_id with target environment ID
            s_env_id = service.get("environment_id")
            if s_env_id == env_id:
                try:
                    self.delete_service(uuid)
                    results.append({"uuid": uuid, "name": name, "status": "deleted"})
                except Exception as e:
                    results.append({"uuid": uuid, "name": name, "status": "failed", "error": str(e)})
        return {"success": True, "deleted_services": results}

    def verify_pocketbase_auth(self, fqdn: str, pb_email: str, pb_password: str) -> tuple[bool, str, str]:
        """
        Authenticate against PocketBase admin endpoints:
        Supports PocketBase v0.23+ (_superusers collection) and legacy (< v0.23) endpoints.
        """
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

                    # Confirm the token actually works
                    headers   = {"Authorization": f"Bearer {token}"}
                    col_resp  = requests.get(f"{fqdn}/api/collections", headers=headers, timeout=8)
                    col_count = (
                        len(col_resp.json().get("items", []))
                        if col_resp.status_code == 200
                        else "?"
                    )
                    msg = (
                        f"Auth OK via {label} endpoint. "
                        f"Token valid ({col_count} collections accessible)."
                    )
                    return True, msg, token

                if resp.status_code == 404:
                    continue   # try next endpoint
                return False, f"{label}: HTTP {resp.status_code} – {resp.text[:120]}", ""

            except requests.RequestException as exc:
                if self.verbose:
                    print(f"  [WARNING] Connection error ({label}): {exc}")
                continue

        return False, "All authentication endpoints failed.", ""

    def deploy_pocketbase(
        self,
        project_uuid: str,
        environment_name: str,
        server_uuid: str,
        docker_compose_template_content: str,
        destination_uuid: Optional[str] = None,
        admin_email: str = "admin@pocketbase.local",
        admin_password: Optional[str] = None,
        custom_id: Optional[str] = None,
        clean: bool = False,
        initial_boot_delay: int = 15,
        max_wait_seconds: int = 300,
    ) -> Dict[str, Any]:
        """
        Deploy and verify PocketBase stack to Coolify.
        
        :param project_uuid: UUID of the Coolify project.
        :param environment_name: Environment name (e.g. 'production').
        :param server_uuid: Server UUID.
        :param docker_compose_template_content: Raw docker-compose content with placeholders.
        :param destination_uuid: Target Destination UUID (optional).
        :param admin_email: PocketBase admin email.
        :param admin_password: PocketBase admin password (randomly generated if None).
        :param custom_id: Unique identifier for service isolation.
        :param clean: If True, deletes all other services in target environment before deploy.
        :param initial_boot_delay: Initial sleep before polling statuses.
        :param max_wait_seconds: Maximum time to wait for container to be ready.
        :return: Deployment details dict.
        """
        def _log(msg: str) -> None:
            ts = time.strftime("%H:%M:%S")
            safe = msg.encode("ascii", errors="replace").decode("ascii")
            print(f"[{ts}] {safe}", flush=True)

        if not admin_password:
            # Generate a secure random password
            alphabet = string.ascii_letters + string.digits
            admin_password = "".join(secrets.choice(alphabet) for _ in range(12))

        unique_id = custom_id or uuid.uuid4().hex[:8]
        service_name = f"pocketbase-{unique_id}"
        fqdn = f"http://pb-{unique_id}.10.10.3.111.sslip.io"

        _log("=" * 60)
        _log("  DEPLOYING POCKETBASE SERVICE STACK TO COOLIFY")
        _log("=" * 60)
        _log(f"Service Name  : {service_name}")
        _log(f"Target Project: {project_uuid}")
        _log(f"Target Env    : {environment_name}")
        _log(f"Target Server : {server_uuid}")
        _log(f"Target URL    : {fqdn}")
        _log(f"Admin Email   : {admin_email}")
        _log(f"Admin Password: {admin_password}")
        _log("=" * 60)

        # Apply placeholders to compose content
        compose_content = (
            docker_compose_template_content
            .replace("${UNIQUE_ID}", unique_id)
            .replace("${PB_ADMIN_EMAIL}", admin_email)
            .replace("${PB_ADMIN_PASSWORD}", admin_password)
        )

        if clean:
            _log("Removing existing services before fresh deploy...")
            try:
                result = self.delete_all_services(project_uuid, environment_name)
                _log(f"Cleanup done: {result}")
            except Exception as exc:
                _log(f"[WARNING] Cleanup error: {exc}")
            _log("Waiting 5s for Docker to release resources...")
            time.sleep(5)

        _log("Creating service on Coolify...")
        urls_mapping = [{"name": "pocketbase", "url": f"{fqdn}:8090"}]

        res = self.create_service(
            name=service_name,
            project_uuid=project_uuid,
            environment_name=environment_name,
            server_uuid=server_uuid,
            docker_compose_content=compose_content,
            destination_uuid=destination_uuid,
            urls=urls_mapping,
            instant_deploy=True,
        )

        service_uuid = res.get("uuid")
        _log(f"Service created  UUID={service_uuid}")

        try:
            self.start_service(service_uuid)
            _log("start_service triggered successfully.")
        except Exception as exc:
            _log(f"[INFO] start_service response: {exc}")

        _log(f"Waiting {initial_boot_delay}s for Coolify to schedule the container...")
        time.sleep(initial_boot_delay)

        deadline = time.time() + max_wait_seconds
        running_statuses = {"running", "healthy", "starting"}
        failed_statuses = {"error", "failed", "dead"}
        poll_intervals = [5, 5, 5, 10, 10, 10, 15, 15, 15, 20]
        interval_idx = 0

        # Phase 1: Wait for running
        _log("Phase 1: Waiting for container to reach running state...")
        container_running = False
        while time.time() < deadline:
            try:
                details = self.get_service(service_uuid)
                svc_status = details.get("status", "")
                apps = details.get("applications", [])
                app_status = apps[0].get("status", "") if apps else ""
                _log(f"  Coolify={svc_status!r}  App={app_status!r}")

                effective = app_status or svc_status
                if any(s in effective for s in running_statuses):
                    _log("  -> Container is running!")
                    container_running = True
                    break
                if any(s in effective for s in failed_statuses):
                    _log(f"  -> Deployment failed: {effective!r}")
                    break
            except Exception as e:
                _log(f"  [WARNING] Could not fetch service status: {e}")

            interval = poll_intervals[min(interval_idx, len(poll_intervals) - 1)]
            interval_idx += 1
            time.sleep(interval)

        if not container_running:
            raise TimeoutError("Container did not reach running state.")

        # Phase 2: Wait for /api/health
        _log(f"Phase 2: Waiting for health endpoint {fqdn}/api/health ...")
        health_ok = False
        interval_idx = 0
        while time.time() < deadline:
            try:
                resp = requests.get(f"{fqdn}/api/health", timeout=5)
                _log(f"  /api/health -> HTTP {resp.status_code}")
                if resp.status_code == 200:
                    health_ok = True
                    break
            except requests.RequestException as e:
                _log(f"  [WAITING] Endpoint not ready: {type(e).__name__}")

            interval = poll_intervals[min(interval_idx, len(poll_intervals) - 1)]
            interval_idx += 1
            time.sleep(interval)

        if not health_ok:
            raise TimeoutError("PocketBase health check endpoint timed out.")

        # Phase 3: Verify Admin auth
        _log("Phase 3: Verifying admin credentials and token...")
        auth_ok, auth_msg, token = self.verify_pocketbase_auth(fqdn, admin_email, admin_password)
        if not auth_ok:
            raise RuntimeError(f"Authentication verification failed: {auth_msg}")

        _log(f"  [SUCCESS] {auth_msg}")
        _log("=" * 60)
        _log("  DEPLOYMENT COMPLETED & VERIFIED SUCCESSFULLY!")
        _log("=" * 60)

        return {
            "success": True,

            "service_uuid": service_uuid,
            "fqdn": fqdn,
            "admin_email": admin_email,
            "admin_password": admin_password,
            "auth_token": token
        }


def run_interactive_cli(client: CoolifyClient) -> None:
    # Disable verbose logging to avoid JSON pollution in CLI
    client.verbose = False
    console = Console()

    def show_header():
        console.clear()
        console.print(Panel(
            "[bold cyan]COOLIFY INTERACTIVE CLI MANAGER[/bold cyan]\n"
            "[dim]Easily monitor projects, environments, services, servers and clean up resources.[/dim]",
            border_style="cyan",
            padding=(1, 2)
        ))

    while True:
        show_header()
        choice = inquirer.select(
            message="Select action:",
            choices=[
                Choice("projects", "📂 View & Manage Projects"),
                Choice("servers", "🖥️ View Servers & Destinations"),
                Choice("delete_service_global", "🗑️ Delete a Service (Global Search)"),
                Choice("exit", "❌ Exit")
            ],
            pointer="❯",
            qmark="✦",
            amark="✔",
        ).execute()

        if not choice or choice == "exit":
            console.print("[yellow]Exiting Coolify CLI Manager. Goodbye![/yellow]")
            break

        try:
            if choice == "projects":
                manage_projects_flow(client, console)
            elif choice == "servers":
                view_servers_flow(client, console)
            elif choice == "delete_service_global":
                delete_service_global_flow(client, console)
        except Exception as e:
            console.print(f"[bold red]Error:[/] {e}")
            input("\nPress Enter to return to main menu...")


def manage_projects_flow(client: CoolifyClient, console: Console) -> None:
    with console.status("[bold cyan]Loading projects...", spinner="dots"):
        projects = client.get_projects()

    if not projects:
        console.print("[yellow]No projects found.[/yellow]")
        input("\nPress Enter to return...")
        return

    # Let user select project
    project_choices = []
    for idx, p in enumerate(projects, 1):
        name = p.get("name", "Unnamed")
        uuid_str = p.get("uuid", "N/A")
        desc = p.get("description") or "No description"
        project_choices.append(Choice(value=p, name=f"{idx:2d}. {name:<25} │ {desc:<35} │ {uuid_str}"))
    
    project_choices.append(Choice(value=None, name="[Go Back]"))

    selected_project = inquirer.fuzzy(
        message="Select target project:",
        choices=project_choices,
        match_exact=False,
        pointer="❯",
        instruction="[Type to search]",
    ).execute()

    if not selected_project:
        return

    p_uuid = selected_project.get("uuid")
    
    while True:
        with console.status("[bold cyan]Loading project details & environments...", spinner="dots"):
            detailed_project = client.get_project(p_uuid)
            environments = detailed_project.get("environments", [])

        console.clear()
        console.print(Panel(
            f"[bold cyan]Project:[/] {detailed_project.get('name')}\n"
            f"[bold cyan]UUID:[/] {p_uuid}\n"
            f"[bold cyan]Description:[/] {detailed_project.get('description') or 'None'}",
            border_style="green"
        ))

        # Show Environments table
        if environments:
            table = Table(title="Project Environments")
            table.add_column("Environment Name", style="cyan")
            table.add_column("Created At", style="dim")
            table.add_column("Updated At", style="dim")
            for env in environments:
                table.add_row(
                    env.get("name", "N/A"),
                    env.get("created_at", "N/A"),
                    env.get("updated_at", "N/A")
                )
            console.print(table)
        else:
            console.print("[yellow]No environments configured for this project.[/yellow]")

        action = inquirer.select(
            message="Project Action:",
            choices=[
                Choice("manage_services", "📦 Manage Services in Project"),
                Choice("delete_project", "🔥 Delete Project"),
                Choice("back", "⬅️ Go Back")
            ],
            pointer="❯",
        ).execute()

        if action == "back" or not action:
            break

        if action == "delete_project":
            confirm = inquirer.confirm(
                message=f"Are you absolutely sure you want to delete project '{detailed_project.get('name')}'?",
                default=False
            ).execute()
            if confirm:
                with console.status("[bold red]Deleting project...", spinner="dots"):
                    client.delete_project(p_uuid)
                console.print(f"[bold green]✔[/bold green] Project '{detailed_project.get('name')}' deleted successfully.")
                input("\nPress Enter to return...")
                break
            else:
                console.print("[yellow]Deletion cancelled.[/yellow]")
                time.sleep(1)

        elif action == "manage_services":
            manage_project_services_flow(client, console, detailed_project)


def manage_project_services_flow(client: CoolifyClient, console: Console, project: Dict[str, Any]) -> None:
    p_uuid = project.get("uuid")
    with console.status("[bold cyan]Loading services...", spinner="dots"):
        # We fetch all services globally, then filter those belonging to environments of this project
        all_services = client.get_services()
        env_ids = {env.get("id") for env in project.get("environments", []) if env.get("id")}
        project_services = [s for s in all_services if s.get("environment_id") in env_ids]

    if not project_services:
        console.print("[yellow]No services found in this project.[/yellow]")
        input("\nPress Enter to return...")
        return

    while True:
        console.clear()
        console.print(f"[bold cyan]Services in Project '{project.get('name')}':[/bold cyan]")
        
        service_choices = []
        for idx, s in enumerate(project_services, 1):
            name = s.get("name", "Unnamed")
            uuid_str = s.get("uuid", "N/A")
            status = s.get("status", "unknown")
            status_style = "[green]running[/]" if "running" in status or "healthy" in status else "[red]stopped[/]"
            service_choices.append(Choice(value=s, name=f"{idx:2d}. {name:<25} │ Status: {status_style:<18} │ {uuid_str}"))
        
        service_choices.append(Choice(value=None, name="[Go Back]"))

        selected_service = inquirer.fuzzy(
            message="Select service to view details/delete:",
            choices=service_choices,
            match_exact=False,
            pointer="❯",
        ).execute()

        if not selected_service:
            break

        svc_uuid = selected_service.get("uuid")
        svc_name = selected_service.get("name")

        # Load details of service
        with console.status(f"[bold cyan]Loading service details for {svc_name}...", spinner="dots"):
            details = client.get_service(svc_uuid)
            status = details.get("status", "unknown")
            apps = details.get("applications", [])

        console.clear()
        console.print(Panel(
            f"[bold cyan]Service Name:[/] {svc_name}\n"
            f"[bold cyan]UUID        :[/] {svc_uuid}\n"
            f"[bold cyan]Status      :[/] {status}",
            title="Service Details",
            border_style="magenta"
        ))

        if apps:
            app_table = Table(title="Application Components")
            app_table.add_column("Component Name", style="cyan")
            app_table.add_column("Status", style="bold")
            app_table.add_column("FQDN", style="underline")
            for app in apps:
                app_status = app.get("status", "unknown")
                status_color = "green" if "running" in app_status or "healthy" in app_status else "red"
                app_table.add_row(
                    app.get("name", "N/A"),
                    f"[{status_color}]{app_status}[/]",
                    app.get("fqdn", "N/A")
                )
            console.print(app_table)

        svc_action = inquirer.select(
            message="Service Action:",
            choices=[
                Choice("start", "▶️ Start/Deploy Service"),
                Choice("stop", "⏹️ Stop Service"),
                Choice("delete", "🔥 Delete Service"),
                Choice("back", "⬅️ Go Back")
            ],
            pointer="❯",
        ).execute()

        if svc_action == "back" or not svc_action:
            continue

        if svc_action == "delete":
            confirm = inquirer.confirm(
                message=f"Are you absolutely sure you want to delete service '{svc_name}'?",
                default=False
            ).execute()
            if confirm:
                with console.status("[bold red]Deleting service...", spinner="dots"):
                    client.delete_service(svc_uuid)
                console.print(f"[bold green]✔[/bold green] Service '{svc_name}' deleted.")
                # Update list
                project_services = [s for s in project_services if s.get("uuid") != svc_uuid]
                input("\nPress Enter to continue...")
                if not project_services:
                    break
            else:
                console.print("[yellow]Deletion cancelled.[/yellow]")
                time.sleep(1)
        elif svc_action == "start":
            with console.status("[bold green]Starting service...", spinner="dots"):
                client.start_service(svc_uuid)
            console.print(f"[bold green]✔[/bold green] Start/Deploy signal sent to service '{svc_name}'.")
            input("\nPress Enter to continue...")
        elif svc_action == "stop":
            with console.status("[bold yellow]Stopping service...", spinner="dots"):
                client.stop_service(svc_uuid)
            console.print(f"[bold green]✔[/bold green] Stop signal sent to service '{svc_name}'.")
            input("\nPress Enter to continue...")


def view_servers_flow(client: CoolifyClient, console: Console) -> None:
    with console.status("[bold cyan]Loading servers...", spinner="dots"):
        servers = client.get_servers()

    if not servers:
        console.print("[yellow]No servers found.[/yellow]")
        input("\nPress Enter to return...")
        return

    table = Table(title="Coolify Servers")
    table.add_column("Server Name", style="cyan")
    table.add_column("IP Address", style="bold")
    table.add_column("Status", style="bold")
    table.add_column("Proxy Type", style="dim")
    table.add_column("UUID", style="dim")

    for s in servers:
        status = s.get("status", "unknown")
        status_color = "green" if "online" in status or status == "running" else "red"
        table.add_row(
            s.get("name", "Unnamed"),
            s.get("ip", "N/A"),
            f"[{status_color}]{status}[/]",
            s.get("proxy", {}).get("type", "None"),
            s.get("uuid", "N/A")
        )

    console.clear()
    console.print(table)

    # Allow selecting a server to view Docker destinations
    server_choices = [Choice(value=s, name=f"{s.get('name')} ({s.get('ip')})") for s in servers]
    server_choices.append(Choice(value=None, name="[Go Back]"))

    selected_server = inquirer.select(
        message="Select a server to view Docker destinations:",
        choices=server_choices,
        pointer="❯",
    ).execute()

    if not selected_server:
        return

    server_uuid = selected_server.get("uuid")
    with console.status("[bold cyan]Loading destinations...", spinner="dots"):
        destinations = client.get_server_destinations(server_uuid)

    if destinations:
        dest_table = Table(title=f"Docker Destinations on {selected_server.get('name')}")
        dest_table.add_column("Destination Name", style="cyan")
        dest_table.add_column("Docker Network", style="magenta")
        dest_table.add_column("UUID", style="dim")
        for dest in destinations:
            dest_table.add_row(
                dest.get("name", "Unnamed"),
                dest.get("network", "N/A"),
                dest.get("uuid", "N/A")
            )
        console.print(dest_table)
    else:
        console.print("[yellow]No Docker destinations configured on this server.[/yellow]")

    input("\nPress Enter to return...")


def delete_service_global_flow(client: CoolifyClient, console: Console) -> None:
    with console.status("[bold cyan]Loading all services...", spinner="dots"):
        services = client.get_services()

    if not services:
        console.print("[yellow]No services found globally.[/yellow]")
        input("\nPress Enter to return...")
        return

    service_choices = []
    for idx, s in enumerate(services, 1):
        name = s.get("name", "Unnamed")
        uuid_str = s.get("uuid", "N/A")
        status = s.get("status", "unknown")
        status_style = "[green]running[/]" if "running" in status or "healthy" in status else "[red]stopped[/]"
        service_choices.append(Choice(value=s, name=f"{idx:2d}. {name:<25} │ Status: {status_style:<18} │ {uuid_str}"))

    service_choices.append(Choice(value=None, name="[Go Back]"))

    selected_service = inquirer.fuzzy(
        message="Select service to delete (Global):",
        choices=service_choices,
        match_exact=False,
        pointer="❯",
    ).execute()

    if not selected_service:
        return

    svc_uuid = selected_service.get("uuid")
    svc_name = selected_service.get("name")

    confirm = inquirer.confirm(
        message=f"Are you absolutely sure you want to delete service '{svc_name}' (UUID: {svc_uuid})?",
        default=False
    ).execute()

    if confirm:
        with console.status("[bold red]Deleting service...", spinner="dots"):
            client.delete_service(svc_uuid)
        console.print(f"[bold green]✔[/bold green] Service '{svc_name}' has been deleted successfully.")
    else:
        console.print("[yellow]Deletion cancelled.[/yellow]")

    input("\nPress Enter to return...")


if __name__ == "__main__":
    import sys
    import os
    import argparse
    
    # Try importing config from parent folder
    try:
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
        from config import COOLIFY_API_URL, COOLIFY_API_TOKEN
    except Exception:
        COOLIFY_API_URL = os.getenv("COOLIFY_API_URL", "http://10.10.3.111:8000/api/v1")
        COOLIFY_API_TOKEN = os.getenv("COOLIFY_API_TOKEN", "")

    # Define tools guide content
    tools_guide = """
================================================================================
               COOLIFY CLI TOOLS & FUNCTION GUIDE
================================================================================
1. get-projects
   - Description: List all projects in Coolify
   - Usage: python client.py get-projects

2. create-project
   - Description: Create a new project
   - Usage: python client.py create-project --name <name> [--description <desc>]

3. delete-project
   - Description: Delete a project by UUID
   - Usage: python client.py delete-project <uuid>

4. get-environments
   - Description: List environments for a project
   - Usage: python client.py get-environments <project_uuid>

5. get-project
   - Description: Get detailed project info by UUID
   - Usage: python client.py get-project <project_uuid>

6. get-services
   - Description: List all services in Coolify
   - Usage: python client.py get-services

7. get-applications
   - Description: List all applications
   - Usage: python client.py get-applications

8. get-databases
   - Description: List all databases
   - Usage: python client.py get-databases

9. get-servers
   - Description: List all servers
   - Usage: python client.py get-servers

10. get-server
    - Description: Get detailed server info by UUID
    - Usage: python client.py get-server <server_uuid>

11. get-server-destinations
    - Description: List destinations for a server
    - Usage: python client.py get-server-destinations <server_uuid>

12. create-service
    - Description: Create a compose service stack and deploy it
    - Usage: python client.py create-service --name <name> --project-uuid <project_uuid> --server-uuid <server_uuid> --compose-file <compose_file_path> [--dest-uuid <dest_uuid>] [--urls <urls_json>] [--no-instant-deploy]

13. get-service
    - Description: Get details of a service stack
    - Usage: python client.py get-service <uuid>

14. get-service-apps
    - Description: Get application components of a service
    - Usage: python client.py get-service-apps <uuid>

15. start-service
    - Description: Start/Deploy a service stack
    - Usage: python client.py start-service <uuid>

16. stop-service
    - Description: Stop a running service stack
    - Usage: python client.py stop-service <uuid>

17. delete-service
    - Description: Delete a service stack (removes config and stops containers)
    - Usage: python client.py delete-service <uuid>

18. delete-all-services
    - Description: Delete ALL services configured in Coolify (loops and deletes each)
    - Usage: python client.py delete-all-services
================================================================================
"""

    # Custom argument parser to handle --tools first without forcing command selection
    class ToolArgumentParser(argparse.ArgumentParser):
        def error(self, message):
            if "--tools" in sys.argv:
                print(tools_guide)
                sys.exit(0)
            super().error(message)

    parser = ToolArgumentParser(description="Coolify API CLI Client")
    parser.add_argument("--api-url", default=COOLIFY_API_URL, help="Base URL of Coolify API")
    parser.add_argument("--token", default=COOLIFY_API_TOKEN, help="Sanctum API Token")
    parser.add_argument("--tools", action="store_true", help="Show all available tools and usage explanations")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # get-projects
    subparsers.add_parser("get-projects", help="List all projects")
    
    # create-project
    cp_parser = subparsers.add_parser("create-project", help="Create a new project")
    cp_parser.add_argument("--name", required=True, help="Project name")
    cp_parser.add_argument("--description", help="Project description")
    
    # delete-project
    dp_parser = subparsers.add_parser("delete-project", help="Delete a project by UUID")
    dp_parser.add_argument("uuid", help="Project UUID")
    
    # get-environments
    ge_parser = subparsers.add_parser("get-environments", help="List environments for a project")
    ge_parser.add_argument("project_uuid", help="Project UUID")
    
    # get-project
    gp_parser = subparsers.add_parser("get-project", help="Get detailed project info by UUID")
    gp_parser.add_argument("project_uuid", help="Project UUID")
    
    # get-services
    subparsers.add_parser("get-services", help="List all services")
    
    # get-applications
    subparsers.add_parser("get-applications", help="List all applications")
    
    # get-databases
    subparsers.add_parser("get-databases", help="List all databases")
    
    # get-servers
    subparsers.add_parser("get-servers", help="List all servers")
    
    # get-server
    gs_parser = subparsers.add_parser("get-server", help="Get detailed server info by UUID")
    gs_parser.add_argument("server_uuid", help="Server UUID")
    
    # get-server-destinations
    gd_parser = subparsers.add_parser("get-server-destinations", help="List destinations for a server")
    gd_parser.add_argument("server_uuid", help="Server UUID")
    
    # create-service
    csv_parser = subparsers.add_parser("create-service", help="Create compose service stack")
    csv_parser.add_argument("--name", required=True, help="Service name")
    csv_parser.add_argument("--project-uuid", required=True, help="Target Project UUID")
    csv_parser.add_argument("--env-name", default="production", help="Environment name")
    csv_parser.add_argument("--server-uuid", required=True, help="Target Server UUID")
    csv_parser.add_argument("--compose-file", required=True, help="Path to local docker-compose YAML file")
    csv_parser.add_argument("--dest-uuid", help="Destination UUID")
    csv_parser.add_argument("--urls", help="JSON string of URLs mapping e.g. '[{\"name\":\"web\",\"url\":\"http://my-web.com\"}]'")
    csv_parser.add_argument("--no-instant-deploy", action="store_false", dest="instant_deploy", help="Disable instant deploy")
    
    # get-service
    gsv_parser = subparsers.add_parser("get-service", help="Get details of a service stack")
    gsv_parser.add_argument("uuid", help="Service UUID")
    
    # get-service-apps
    gsa_parser = subparsers.add_parser("get-service-apps", help="Get application components of a service")
    gsa_parser.add_argument("uuid", help="Service UUID")
    
    # start-service
    start_parser = subparsers.add_parser("start-service", help="Start/Deploy service stack")
    start_parser.add_argument("uuid", help="Service UUID")
    
    # stop-service
    stop_parser = subparsers.add_parser("stop-service", help="Stop service stack")
    stop_parser.add_argument("uuid", help="Service UUID")
    
    # delete-service
    del_parser = subparsers.add_parser("delete-service", help="Delete service stack")
    del_parser.add_argument("uuid", help="Service UUID")

    # delete-all-services
    das_parser = subparsers.add_parser("delete-all-services", help="Delete ALL services in a specific project and environment")
    das_parser.add_argument("--project-uuid", help="Target Project UUID")
    das_parser.add_argument("--env-name", help="Target Environment Name (e.g. production)")
    
    args = parser.parse_args()
    
    if args.tools:
        print(tools_guide)
        sys.exit(0)
        
    if not args.command:
        if not args.token:
            print("[ERROR] Token must be provided via --token or COOLIFY_API_TOKEN environment variable/config file.")
            sys.exit(1)
        client = CoolifyClient(base_url=args.api_url, token=args.token)
        try:
            run_interactive_cli(client)
        except KeyboardInterrupt:
            print("\nExiting Coolify CLI Manager...")
        sys.exit(0)

    if not args.token:
        print("[ERROR] Token must be provided via --token or COOLIFY_API_TOKEN environment variable/config file.")
        sys.exit(1)
        
    client = CoolifyClient(base_url=args.api_url, token=args.token)
    
    try:
        if args.command == "get-projects":
            res = client.get_projects()
        elif args.command == "create-project":
            res = client.create_project(args.name, args.description)
        elif args.command == "delete-project":
            res = client.delete_project(args.uuid)
        elif args.command == "get-environments":
            res = client.get_environments(args.project_uuid)
        elif args.command == "get-project":
            res = client.get_project(args.project_uuid)
        elif args.command == "get-services":
            res = client.get_services()
        elif args.command == "get-applications":
            res = client.get_applications()
        elif args.command == "get-databases":
            res = client.get_databases()
        elif args.command == "get-servers":
            res = client.get_servers()
        elif args.command == "get-server":
            res = client.get_server(args.server_uuid)
        elif args.command == "get-server-destinations":
            res = client.get_server_destinations(args.server_uuid)
        elif args.command == "create-service":
            if not os.path.exists(args.compose_file):
                print(f"[ERROR] Compose file not found: {args.compose_file}")
                sys.exit(1)
            with open(args.compose_file, "r", encoding="utf-8") as f:
                compose_content = f.read()
            urls_list = json.loads(args.urls) if args.urls else None
            res = client.create_service(
                name=args.name,
                project_uuid=args.project_uuid,
                environment_name=args.env_name,
                server_uuid=args.server_uuid,
                docker_compose_content=compose_content,
                destination_uuid=args.dest_uuid,
                urls=urls_list,
                instant_deploy=args.instant_deploy
            )
        elif args.command == "get-service":
            res = client.get_service(args.uuid)
        elif args.command == "get-service-apps":
            res = client.get_service_applications(args.uuid)
        elif args.command == "start-service":
            res = client.start_service(args.uuid)
        elif args.command == "stop-service":
            res = client.stop_service(args.uuid)
        elif args.command == "delete-service":
            res = client.delete_service(args.uuid)
        elif args.command == "delete-all-services":
            if not args.project_uuid or not args.env_name:
                print("\n" + "!"*80)
                print("[ERROR] Missing required parameters: --project-uuid and --env-name are required.")
                print("!"*80)
                print("To retrieve the correct parameters, please run the following commands:")
                print("1. Find your Project UUID:")
                print("   python client.py get-projects")
                print("2. Find your Environment Name for a project:")
                print("   python client.py get-environments <project_uuid>")
                print("="*80 + "\n")
                sys.exit(1)
            res = client.delete_all_services(args.project_uuid, args.env_name)
    except Exception as e:
        sys.exit(1)
