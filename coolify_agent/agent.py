import os
from dotenv import load_dotenv
from google.adk.agents.llm_agent import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

# Load environment variables from base project .env (C:\Users\wajeepradit.p\git\coolify\.env)
agent_dir = os.path.dirname(os.path.abspath(__file__))
root_env = os.path.abspath(os.path.join(agent_dir, "..", ".env"))

if os.path.exists(root_env):
    load_dotenv(root_env, override=True)
else:
    load_dotenv(override=True)

# Extract Ollama configuration
ollama_base_url = os.getenv("OLLAMA_BASE_URL", "https://ollama.com/v1")
ollama_api_key = os.getenv("OLLAMA_API_KEY", "1d1ef96cd1f44021bac1ad3e449adcaf.ZQdARymEAfyYbwhWlN-tK3tk")

# Define the LiteLLM model using the OpenAI provider pointing to Ollama Cloud
ollama_model = LiteLlm(
    model='openai/gpt-oss:20b',
    api_base=ollama_base_url,
    api_key=ollama_api_key
)

# Setup workspace root paths for MCP connection
workspace_root = os.path.dirname(agent_dir)
python_exe = os.path.join(workspace_root, ".venv", "Scripts", "python.exe")
if not os.path.exists(python_exe):
    python_exe = "python"  # Fallback to system python

mcp_script = os.path.join(workspace_root, "deploy_app", "coolify", "mcp_server.py")

# Create connection parameters
connection_params = StdioConnectionParams(
    server_params=StdioServerParameters(
        command=python_exe,
        args=[mcp_script],
        env=os.environ.copy()
    ),
    timeout=10.0
)

# Custom Toolset to intercept write/deploy actions and set require_confirmation to True
class CoolifyMcpToolset(McpToolset):
    async def get_tools(self, readonly_context=None):
        tools = await super().get_tools(readonly_context)
        # Keep only tools starting with 'get_' to enforce strict read-only permissions
        readonly_tools = [t for t in tools if t.name.startswith("get_")]
        return readonly_tools

# Instantiate the custom MCP Toolset
mcp_toolset = CoolifyMcpToolset(connection_params=connection_params)

# Define the Agent
root_agent = Agent(
    model=ollama_model,
    name='root_agent',
    description='A DevOps read-only inspector assistant that retrieves Coolify infrastructure state.',
    instruction=(
        "You are a DevOps inspector assistant. You have strict READ-ONLY access. "
        "Your role is to inspect and report current infrastructure states (projects, environments, servers, services, applications). "
        "Use the appropriate 'get_' tools to query details. "
        "Explain briefly what you are doing before calling tools. "
        "Answer concisely and clearly to minimize output tokens. Do not suggest or attempt to modify, create, delete, or start/stop resources."
    ),
    tools=[mcp_toolset]
)
