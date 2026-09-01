import os
import sys

# Add parent directory to path to load config
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))
from config import (
    COOLIFY_API_URL,
    COOLIFY_API_TOKEN,
    TARGET_PROJECT_UUID,
    TARGET_ENVIRONMENT_NAME,
    TARGET_SERVER_UUID,
    TARGET_DESTINATION_UUID,
    OPENWEBUI_BASE_URL,
    OPENWEBUI_ADMIN_TOKEN,
    AGENTS_DIR,
    LDAP_HOST,
    LDAP_PORT,
    LDAP_BASE_DN,
    LDAP_BIND_USER,
    LDAP_BIND_PASSWORD,
    LDAP_USER_FILTER,
    LDAP_DOMAIN,
)

# SQLite Database path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", os.path.join(BASE_DIR, "jobs.db"))

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_QUEUE_NAME = "coolify_jobs_queue"

def get_redis_client():
    """Attempt connecting to real Redis; fall back to FileRedis if offline."""
    try:
        import redis
        client = redis.from_url(REDIS_URL, socket_timeout=2.0)
        client.ping()
        return client
    except Exception as e:
        # Import dynamically to avoid circular dependencies
        from open_webui.app.file_redis import FileRedis
        return FileRedis()

