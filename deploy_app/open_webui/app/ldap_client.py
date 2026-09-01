import os
import sys
import secrets
import string
import requests
from typing import List, Dict, Any, Optional

try:
    from ldap3 import Server, Connection, ALL, SUBTREE, ALL_ATTRIBUTES
    HAS_LDAP3 = True
except ImportError:
    HAS_LDAP3 = False

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from open_webui.app.settings import (
    LDAP_HOST,
    LDAP_PORT,
    LDAP_BASE_DN,
    LDAP_BIND_USER,
    LDAP_BIND_PASSWORD,
    LDAP_USER_FILTER,
    LDAP_DOMAIN,
    OPENWEBUI_BASE_URL,
)
from open_webui.client import OpenWebUIClient


class LDAPClient:
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        base_dn: Optional[str] = None,
        bind_user: Optional[str] = None,
        bind_password: Optional[str] = None,
        domain: Optional[str] = None,
    ):
        self.host = host if host is not None else LDAP_HOST
        self.port = port if port is not None else LDAP_PORT
        self.base_dn = base_dn if base_dn is not None else LDAP_BASE_DN
        self.bind_user = bind_user if bind_user is not None else LDAP_BIND_USER
        self.bind_password = bind_password if bind_password is not None else LDAP_BIND_PASSWORD
        self.domain = domain if domain is not None else (LDAP_DOMAIN or "aapico.com")

    def is_configured(self) -> bool:
        return bool(self.host and self.base_dn)

    def search_users(self, query: str = "", limit: int = 40) -> List[Dict[str, Any]]:
        """Search LDAP/Active Directory for user objects matching query."""
        if not HAS_LDAP3:
            print("[WARNING] ldap3 library is not installed.")
            return []

        if not self.is_configured():
            print("[INFO] LDAP is not fully configured (LDAP_HOST or LDAP_BASE_DN missing).")
            return []

        clean_q = query.strip().replace("(", "").replace(")", "").replace("\\", "").replace("*", "")
        
        # Build LDAP search filter
        if clean_q:
            search_filter = (
                f"(&(objectClass=user)(!(objectClass=computer))"
                f"(|(sAMAccountName=*{clean_q}*)(displayName=*{clean_q}*)"
                f"(mail=*{clean_q}*)(cn=*{clean_q}*)))"
            )
        else:
            search_filter = "(&(objectClass=user)(!(objectClass=computer))(sAMAccountName=*))"

        attributes = [
            "sAMAccountName",
            "displayName",
            "mail",
            "userPrincipalName",
            "cn",
            "department",
            "title",
            "telephoneNumber",
        ]

        results = []
        try:
            server = Server(self.host, port=self.port, get_info=ALL, connect_timeout=5)
            
            # Bind anonymously or with bind credentials if specified
            if self.bind_user and self.bind_password:
                conn = Connection(
                    server,
                    user=self.bind_user,
                    password=self.bind_password,
                    auto_bind=True,
                    receive_timeout=10,
                )
            else:
                conn = Connection(server, auto_bind=True, receive_timeout=10)

            conn.search(
                search_base=self.base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=attributes,
                size_limit=limit,
            )

            for entry in conn.entries:
                username = str(getattr(entry, "sAMAccountName", "") or "")
                display_name = str(getattr(entry, "displayName", "") or getattr(entry, "cn", "") or username)
                mail = str(getattr(entry, "mail", "") or "")
                upn = str(getattr(entry, "userPrincipalName", "") or "")
                department = str(getattr(entry, "department", "") or "")
                title = str(getattr(entry, "title", "") or "")

                if not username:
                    continue

                # Strictly format standard email as {sAMAccountName}@{domain}
                standard_email = f"{username}@{self.domain}".lower()

                results.append({
                    "username": username,
                    "sAMAccountName": username,
                    "name": display_name,
                    "email": standard_email,
                    "department": department,
                    "title": title,
                    "source": "ldap"
                })

            conn.unbind()
        except Exception as e:
            print(f"[ERROR] LDAP query failed on host {self.host}: {e}")
            # Raise exception so caller can report error details
            raise RuntimeError(f"LDAP query failed: {str(e)}")

        return results


def sync_ldap_user_to_openwebui(
    ldap_user: Dict[str, Any],
    openwebui_client: OpenWebUIClient,
    domain: Optional[str] = None
) -> Dict[str, Any]:
    """Check if LDAP user exists in Open WebUI. If not, auto-register them using sAMAccountName and {sAMAccountName}@{domain}."""
    sam_account = ldap_user.get("sAMAccountName") or ldap_user.get("username") or ""
    display_name = ldap_user.get("displayName") or ldap_user.get("name") or sam_account
    user_domain = domain or LDAP_DOMAIN or "aapico.com"
    standard_email = f"{sam_account}@{user_domain}".lower()

    # 1. Fetch existing users to check if user is already registered
    existing_users = openwebui_client.get_users()
    for u in existing_users:
        u_email = (u.get("email") or "").lower()
        u_name = (u.get("name") or "").lower()
        u_user = (u.get("username") or "").lower()
        if (
            (standard_email and u_email == standard_email)
            or (sam_account and u_user == sam_account.lower())
            or (sam_account and u_name == sam_account.lower())
        ):
            return {
                "status": "exists",
                "user": u,
                "created": False
            }

    # 2. User doesn't exist; register them via Open WebUI Admin API using sAMAccountName & standard email
    alphabet = string.ascii_letters + string.digits
    random_password = "".join(secrets.choice(alphabet) for _ in range(16))

    # Use admin endpoint /api/v1/auths/add (name=sAMAccountName, email={sAMAccountName}@{domain})
    add_url = f"{openwebui_client.base_url}/api/v1/auths/add"
    payload = {
        "name": sam_account,
        "email": standard_email,
        "password": random_password,
        "role": "user"
    }

    resp = requests.post(add_url, headers=openwebui_client.headers, json=payload, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        created_user = data.get("user") if (isinstance(data, dict) and isinstance(data.get("user"), dict)) else data
        return {
            "status": "created",
            "created": True,
            "user": {
                "id": created_user.get("id"),
                "name": created_user.get("name", sam_account),
                "email": created_user.get("email", standard_email),
                "role": created_user.get("role", "user")
            },
            "generated_password": random_password
        }
    else:
        try:
            err_msg = resp.json().get("detail", resp.text)
        except Exception:
            err_msg = resp.text
        raise RuntimeError(f"Open WebUI user registration failed: {err_msg}")
