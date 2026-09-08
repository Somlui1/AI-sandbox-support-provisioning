#!/usr/bin/env bash
# ==============================================================================
# One-Click Update & Sync Script for Provisioning Orchestrator
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================================"
echo "         PROVISIONING SYSTEM - ONE-CLICK AUTO UPDATE ENGINE           "
echo "======================================================================"

# 1. Pull latest code from Git
echo "[1/3] Pulling latest updates from Git repository..."
git pull origin main

# 2. Reload Docker containers with volume mounts (Zero Image Rebuild needed)
echo "[2/3] Syncing running Docker containers..."
docker compose up -d

# 3. Health & Token Diagnostic Check
echo "[3/3] Performing container health & credentials verification..."
sleep 2

docker exec provisioning_orchestrator python -c "
from deploy_app.config import COOLIFY_API_URL, COOLIFY_API_TOKEN, OPENWEBUI_BASE_URL
token_preview = f'{COOLIFY_API_TOKEN[:6]}...{COOLIFY_API_TOKEN[-4:]}' if COOLIFY_API_TOKEN and len(COOLIFY_API_TOKEN) > 10 else 'MISSING'
print('----------------------------------------------------------------------')
print(f'  Coolify Target URL : {COOLIFY_API_URL}')
print(f'  Coolify Token      : {token_preview}')
print(f'  OpenWebUI URL      : {OPENWEBUI_BASE_URL}')
print('----------------------------------------------------------------------')
"

echo ""
echo "[OK] System is fully updated and running!"
echo "To view live logs, run: docker compose logs -f orchestrator"
echo "======================================================================"
