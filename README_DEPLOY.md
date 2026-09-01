# Production Deployment Guide: AI Sandbox Provisioning Orchestrator

This repository provides a self-contained, enterprise-ready Docker deployment for the **AI Sandbox Support Provisioning Orchestrator**.

---

## 🏗️ Architecture Overview

The production container stack includes:
1. **Multi-Stage Build (`Dockerfile`)**:
   - **Frontend**: Compiles the React + Vite dashboard inside `node:20-alpine`.
   - **Backend Runtime**: Runs FastAPI + Uvicorn and the asynchronous pipeline Worker inside `python:3.11-slim`.
2. **Redis Service (`redis:7-alpine`)**:
   - Manages distributed job queues with Append-Only File (AOF) persistence.
3. **Persistent Volume (`provisioning_orchestrator_data`)**:
   - Safely retains SQLite database records (`jobs.db`) across restarts and container upgrades.

---

## 🚀 Option 1: Standalone Deployment via Docker Compose

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your production credentials:
```bash
cp .env.example .env
```

Ensure the following variables are configured:
```ini
# Coolify API
COOLIFY_API_URL=http://10.10.3.111:8000/api/v1
COOLIFY_API_TOKEN=<your-token>

# Coolify Target UUIDs
TARGET_PROJECT_UUID=um808swoocssokg0ckoc4wgc
TARGET_SERVER_UUID=gogwg840kwsk8ocgowc4880k
TARGET_DESTINATION_UUID=kck8o88sks8cg8kg488kwc4w
TARGET_ENVIRONMENT_NAME=production

# Open WebUI API
OPENWEBUI_BASE_URL=http://10.10.3.112:8088
OPENWEBUI_ADMIN_TOKEN=<openwebui-jwt-admin-token>

# Active Directory / LDAP
LDAP_HOST=10.10.10.250
LDAP_PORT=389
LDAP_BASE_DN=DC=aapico,DC=com
LDAP_BIND_USER=CN=it_service_portal_U1,OU=AI,DC=AAPICO,DC=COM
LDAP_BIND_PASSWORD=<ldap-password>
LDAP_DOMAIN=aapico.com

# Redis Queue
REDIS_URL=redis://redis:6379/0
```

### 2. Build and Start Services
Run the following command to build the multi-stage image and start the containers in detached mode:
```bash
docker compose up -d --build
```

### 3. Verify Container Status
Check running services and container health:
```bash
docker compose ps
```

View real-time logs for both the web server and the background worker:
```bash
docker compose logs -f orchestrator
```

### 4. Access the Applications
- **Admin & Orchestrator Portal**: `http://<server-ip>:8000/`
- **Employee Request Form**: `http://<server-ip>:8000/request`

---

## 🌐 Option 2: Deploy Inside Coolify as a Service

You can deploy this Orchestrator directly inside your existing **Coolify** instance:

1. In Coolify, click **Projects** ➔ Select your Project & Environment.
2. Click **+ Add Resource** ➔ Select **Docker Compose**.
3. Point to this Git repository (`https://github.com/Somlui1/AI-sandbox-support-provisioning.git`) or paste the contents of `docker-compose.yml`.
4. In the **Environment Variables** tab in Coolify, paste all variables from your `.env` file.
5. In **Domains**, assign your desired FQDN (e.g. `http://provisioning.10.10.3.111.sslip.io`).
6. Click **Deploy**.

---

## 🛠️ Management & Maintenance

### Restart Services
```bash
docker compose restart
```

### Stop Containers (Data Preserved in Volumes)
```bash
docker compose down
```

### Database Backup
The SQLite database is stored in the Docker volume `provisioning_orchestrator_data`. To back it up:
```bash
docker run --rm -v provisioning_orchestrator_data:/data -v $(pwd):/backup alpine tar czf /backup/jobs_backup.tar.gz -C /data .
```
