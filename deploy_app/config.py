import os
import sys
from dotenv import load_dotenv

# Load .env file from root base directory (C:\Users\wajeepradit.p\git\coolify\.env)
base_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(base_dir, ".."))
root_env = os.path.join(root_dir, ".env")

if os.path.exists(root_env):
    load_dotenv(root_env, override=True)
else:
    load_dotenv(override=True)

# API Configuration
COOLIFY_API_URL = os.getenv("COOLIFY_API_URL", "http://10.10.3.222:8000/api/v1").rstrip('/')
COOLIFY_API_TOKEN = os.getenv("COOLIFY_API_TOKEN")

# Target Deployment configuration
TARGET_PROJECT_UUID = os.getenv("TARGET_PROJECT_UUID")
TARGET_ENVIRONMENT_NAME = os.getenv("TARGET_ENVIRONMENT_NAME", "production")
TARGET_SERVER_UUID = os.getenv("TARGET_SERVER_UUID")
TARGET_DESTINATION_UUID = os.getenv("TARGET_DESTINATION_UUID")

# Open WebUI Configuration
OPENWEBUI_BASE_URL = os.getenv("OPENWEBUI_BASE_URL", "http://aico.aapico.com:8080").rstrip('/')
OPENWEBUI_ADMIN_TOKEN = os.getenv("OPENWEBUI_ADMIN_TOKEN")

# Agents Directory
AGENTS_DIR = os.getenv("AGENTS_DIR", os.path.join(base_dir, "agents"))

# LDAP / Active Directory Configuration
LDAP_HOST = os.getenv("LDAP_HOST", "")
LDAP_PORT = int(os.getenv("LDAP_PORT", "389"))
LDAP_BASE_DN = os.getenv("LDAP_BASE_DN", "DC=aapico,DC=com")
LDAP_BIND_USER = os.getenv("LDAP_BIND_USER", "")
LDAP_BIND_PASSWORD = os.getenv("LDAP_BIND_PASSWORD", "")
LDAP_USER_FILTER = os.getenv("LDAP_USER_FILTER", "(objectClass=person)")
LDAP_DOMAIN = os.getenv("LDAP_DOMAIN", "aapico.com")

# Validate required variables
missing = []
if not COOLIFY_API_TOKEN:
    missing.append("COOLIFY_API_TOKEN")
if not TARGET_PROJECT_UUID:
    missing.append("TARGET_PROJECT_UUID")
if not TARGET_SERVER_UUID:
    missing.append("TARGET_SERVER_UUID")
if not OPENWEBUI_ADMIN_TOKEN:
    missing.append("OPENWEBUI_ADMIN_TOKEN")

if missing:
    print(f"Error: Missing required environment variables in .env: {', '.join(missing)}")
    print("Please configure them in your .env file or environment.")
    sys.exit(1)
