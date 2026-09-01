# Coolify Automation System

This project contains tools and configurations for deploying and managing services on Coolify, as well as integrating them with Open WebUI Agents.

## Project Structure
```
coolify/
│
├── .env                   # Central credentials and target configurations (git-ignored)
├── .env.example           # Central environment variables template
├── deploy_app/            # Main application directory for service deployment
│   ├── agents/            # Custom agent blueprints (pocketbase_agent.json)
│   ├── coolify/           # Coolify SDK client
│   ├── open_webui/        # Web application & Open WebUI client
│   └── config.py          # Loads configuration from root .env
│
├── coolify_agent/         # ADK agent directory
├── run.py                 # Orchestration startup script
├── requirements.txt       # Global Python dependencies
└── README.md              # Project documentation (this file)
```

## Setup Instructions

1. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables**:
   Create a `.env` file at the project root directory (you can copy `.env.example` as a template):
   ```ini
   COOLIFY_API_URL=http://10.10.3.111:8000/api/v1
   COOLIFY_API_TOKEN=your_coolify_api_token
   
   TARGET_PROJECT_UUID=your_project_uuid
   TARGET_ENVIRONMENT_NAME=production
   TARGET_SERVER_UUID=your_server_uuid
   TARGET_DESTINATION_UUID=your_destination_uuid
   ```

## Running the Integration Pipeline

To execute the deployment and configuration pipeline, navigate to the `deploy_app/` directory or run the script using the correct working directory path:

### Run Temporary/Standalone Deployment Test (Deploy, Register Agent, Wait 5 min, Auto-destroy)
```bash
cd deploy_app
python deploy_integration.py --mode temporary
```

### Run Permanent Deployment (Left running indefinitely)
```bash
cd deploy_app
python deploy_integration.py --mode permanent
```

### Clean Up / Destroy Permanent Service
```bash
cd deploy_app
python deploy_integration.py --mode destroy
```

## Coolify ADK Agent

An intelligent AI agent using the Google Agent Development Kit (ADK) that connects to the Coolify MCP server, allowing you to manage Coolify infrastructure via natural language.

### Running ADK Agent
```bash
adk web --reload coolify_agent
```
Open `http://127.0.0.1:8000` in your browser to interact.
