# =========================================================================
# STAGE 1: Build React Frontend Assets
# =========================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Copy package descriptors first to take advantage of Docker layer caching
COPY deploy_app/open_webui/frontend/package*.json ./
RUN npm ci --silent || npm install --silent

# Copy frontend source code and build production bundle
COPY deploy_app/open_webui/frontend/ ./
RUN npm run build

# =========================================================================
# STAGE 2: Python Production Runtime
# =========================================================================
FROM python:3.11-slim AS runtime

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    APP_HOME=/app

WORKDIR ${APP_HOME}

# Install essential system dependencies (curl for container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Copy compiled frontend from Stage 1 into the location expected by main.py
COPY --from=frontend-builder /build/dist ./deploy_app/open_webui/frontend/dist

# Ensure data directory exists with write permissions for SQLite database & FileRedis
RUN mkdir -p ./deploy_app/open_webui/app/data && \
    chmod -R 777 ./deploy_app/open_webui/app/data

# Expose Web Orchestrator HTTP port
EXPOSE 8000

# Health check to ensure Uvicorn is serving requests
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/jobs || exit 1

# Default execution: run.py orchestrates both Web Server and Background Worker concurrently
CMD ["python", "-u", "run.py"]
