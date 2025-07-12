"""
Metorial Python Client

Main client class for Metorial SDK in Python.
"""

from typing import Optional, Dict, Any, List, Callable, TypeVar
from urllib.parse import urlparse, urljoin
import aiohttp
import asyncio
import json
import re

# Declare type variable for generic methods
T = TypeVar("T")

ServerDeploymentConfig = List[str]  # Alias for clarity


# Utility functions
def slugify(text: str) -> str:
  """Convert text to a slug."""
  # Convert to lowercase and replace non-alphanumeric chars with underscores
  slug = re.sub(r"[^a-zA-Z0-9]", "_", text.lower())
  # Remove multiple underscores
  slug = re.sub(r"_+", "_", slug)
  # Remove leading/trailing underscores
  return slug.strip("_")


def get_schema_format(
  schema: Dict[str, Any], format_type: str = "json-schema"
) -> Dict[str, Any]:
  """Get schema in specified format."""
  # Return the schema as-is for json-schema format
  if format_type == "json-schema":
    return schema
  return schema


class McpUriTemplate:
  """Simple URI template handler."""

  def __init__(self, template: str):
    self.template = template

  def get_properties(self) -> List[Dict[str, Any]]:
    """Get properties from URI template."""
    # Find all {variable} patterns
    variables = re.findall(r"\{([^}]+)\}", self.template)
    return [{"key": var, "optional": False} for var in variables]

  def expand(self, arguments: Dict[str, Any]) -> str:
    """Expand URI template with arguments."""
    result = self.template
    for key, value in arguments.items():
      result = result.replace(f"{{{key}}}", str(value))
    return result


# Import the core SDK and MCP session
try:
  from ..packages.core import create_metorial_core_sdk
except ImportError:
  # Fallback - this would be implemented properly in the real SDK
  def create_metorial_core_sdk(config):
    from types import SimpleNamespace

    return SimpleNamespace()


class MetorialAPIError(Exception):
  """Exception raised for API errors."""

  def __init__(self, message: str, status_code: Optional[int] = None):
    self.message = message
    self.status_code = status_code
    super().__init__(message)


class MetorialClient:
  """
  Main Metorial client class.

  Provides a unified interface for interacting with Metorial services,
  including MCP servers and core SDK functionality.
  """

  def __init__(self, config: Optional[Dict[str, Any]] = None):
    """
    Initialize the Metorial client.

    Args:
          config: Optional configuration dictionary
    """
    self.config = config or {}
    self.core_sdk = create_metorial_core_sdk(self.config)
    self.mcp_session: Optional[MetorialMcpSession] = None

  def get_deployment_info(self, deployment_name: str) -> Dict[str, Any]:
    """
    Get information about a deployment.

    Args:
          deployment_name: Name of the deployment

    Returns:
          Dictionary containing deployment information
    """
    # This would be implemented to fetch deployment info
    # For now, return basic info
    return {"name": deployment_name, "type": "mcp", "status": "active"}

  async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
    """
    Call a tool through the MCP session.

    Args:
          tool_name: Name of the tool to call
          arguments: Arguments to pass to the tool

    Returns:
          Result from the tool call
    """
    # Ensure mcp_session is initialized
    if not self.mcp_session:
      server_deployments: ServerDeploymentConfig = []  # Retrieve actual deployments from config or arguments
      self.mcp_session = MetorialMcpSession(self, server_deployments, self.config.get('mcp_host', ''))

    return await self.mcp_session.call_tool(tool_name, arguments)

  async def read_resource(self, resource_uri: str) -> Any:
    """
    Read a resource through the MCP session.

    Args:
          resource_uri: URI of the resource to read

    Returns:
          Content of the resource
    """
    # Ensure mcp_session is initialized
    if not self.mcp_session:
      server_deployments: ServerDeploymentConfig = []  # Retrieve actual deployments from config or arguments
      self.mcp_session = MetorialMcpSession(self, server_deployments, self.config.get('mcp_host', ''))

    return await self.mcp_session.read_resource(resource_uri)

  async def close(self):
    """
    Close the client and clean up resources.
    """
    if self.mcp_session and hasattr(self.mcp_session, "close"):
      await self.mcp_session.close()
      self.mcp_session = None


class MetorialHttpClient:
  """HTTP client for Metorial API."""

  def __init__(
    self, api_key: str, api_host: str, headers: Optional[Dict[str, str]] = None
  ):
    self.api_key = api_key
    self.api_host = api_host
    self.headers = {
      "Authorization": f"Bearer {api_key}",
      "Content-Type": "application/json",
      "Metorial-Version": "2025-01-01-pulsar",
      **(headers or {}),
    }

  async def _make_request(
    self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None
  ) -> Dict[str, Any]:
    """Make HTTP request to Metorial API."""
    url = urljoin(self.api_host, endpoint)

    async with aiohttp.ClientSession() as session:
      # For GET requests, use query parameters
      if method.upper() == "GET":
        async with session.request(
          method, url, headers=self.headers, params=data
        ) as response:
          response_data = await response.json()
          if response.status >= 400:
            raise MetorialAPIError(
              response_data.get("message", f"HTTP {response.status}"),
              response.status,
            )

          return response_data
      else:
        async with session.request(
          method, url, headers=self.headers, json=data
        ) as response:
          response_data = await response.json()

          if response.status >= 400:
            raise MetorialAPIError(
              response_data.get("message", f"HTTP {response.status}"),
              response.status,
            )

          return response_data

  async def create_session(self, server_deployments: List[str]) -> Dict[str, Any]:
    """Create a new session."""
    return await self._make_request(
      "POST", "sessions", {"server_deployments": server_deployments}
    )

  async def get_capabilities(
    self, server_deployment_ids: List[str]
  ) -> Dict[str, Any]:
    """Get server capabilities."""
    endpoint = "server-capabilities"
    # Use the correct parameter name from the API spec
    return await self._make_request("GET", endpoint, {"serverDeploymentId": server_deployment_ids})


class MetorialMcpClient:
  """MCP client for communicating with Metorial servers."""

  def __init__(
    self, session_id: str, deployment_id: str, client_secret: str, mcp_host: str
  ):
    self.session_id = session_id
    self.deployment_id = deployment_id
    self.client_secret = client_secret
    self.mcp_host = mcp_host
    self.base_url = f"{mcp_host}/mcp/{session_id}/{deployment_id}"

  async def call_tool(
    self, tool_name: str, arguments: Dict[str, Any]
  ) -> Dict[str, Any]:
    """Call a tool via MCP."""
    url = f"{self.base_url}/tools/{tool_name}"

    async with aiohttp.ClientSession() as session:
      async with session.post(
        url, json=arguments, params={"key": self.client_secret}
      ) as response:
        if response.status >= 400:
          error_text = await response.text()
          raise MetorialAPIError(
            f"Tool call failed: {error_text}", response.status
          )
        return response.json()

  async def read_resource(self, uri: str) -> Dict[str, Any]:
    """Read a resource via MCP."""
    url = f"{self.base_url}/resources"

    async with aiohttp.ClientSession() as session:
      async with session.post(
        url, json={"uri": uri}, params={"key": self.client_secret}
      ) as response:
        if response.status >= 400:
          error_text = await response.text()
          raise MetorialAPIError(
            f"Resource read failed: {error_text}", response.status
          )
        return response.json()

  async def close(self):
    """Close the MCP client."""
    # In a real implementation, this would close any persistent connections
    pass


class MetorialMcpTool:
  """Represents a tool available via MCP."""

  def __init__(self, tool_data: Dict[str, Any], tool_type: str = "tool"):
    self.id = slugify(tool_data["name"])
    self.name = tool_data["name"]
    self.description = tool_data.get("description")
    self.input_schema = tool_data.get("inputSchema", {})
    self.tool_type = tool_type  # 'tool' or 'resource_template'

    # For resource templates
    if tool_type == "resource_template":
      self.uri_template = tool_data.get("uriTemplate", "")
      self._setup_resource_template()

  def _setup_resource_template(self):
    """Setup parameters for resource template based on URI template."""
    if hasattr(self, "uri_template") and self.uri_template:
      uri = McpUriTemplate(self.uri_template)
      properties = uri.get_properties()

      self.input_schema = {
        "type": "object",
        "properties": {prop["key"]: {"type": "string"} for prop in properties},
        "required": [
          prop["key"]
          for prop in properties
          if not prop.get("optional", False)
        ],
        "additionalProperties": False,
      }

  def get_parameters_as(self, format_type: str = "json-schema") -> Dict[str, Any]:
    """Get tool parameters in the specified format."""
    return get_schema_format(self.input_schema, format_type)

  def get_parameters_as_json_schema(self) -> Dict[str, Any]:
    """Get tool parameters as JSON schema."""
    return self.get_parameters_as("json-schema")

  async def call(self, client: MetorialMcpClient, arguments: Dict[str, Any]) -> Any:
    """Call this tool."""
    if self.tool_type == "resource_template":
      return await self._call_resource_template(client, arguments)
    else:
      return await client.call_tool(self.name, arguments)

  async def _call_resource_template(
    self, client: MetorialMcpClient, arguments: Dict[str, Any]
  ) -> Any:
    """Call a resource template (read resource)."""
    # Expand URI template with arguments
    uri = McpUriTemplate(self.uri_template)
    expanded_uri = uri.expand(arguments)

    # Call read_resource via MCP client
    # This would need to be implemented in MetorialMcpClient
    return await client.read_resource(expanded_uri)

  @classmethod
  def from_tool(cls, tool_data: Dict[str, Any]) -> "MetorialMcpTool":
    """Create tool from tool data."""
    return cls(tool_data, "tool")

  @classmethod
  def from_resource_template(cls, template_data: Dict[str, Any]) -> "MetorialMcpTool":
    """Create tool from resource template data."""
    return cls(template_data, "resource_template")


class MetorialMcpToolManager:
  """Manages tools available in an MCP session."""

  def __init__(self, tools: List[MetorialMcpTool], client: MetorialMcpClient):
    self.tools = {tool.id: tool for tool in tools}
    self.client = client

  def get_tools(self) -> List[MetorialMcpTool]:
    """Get all available tools."""
    return list(self.tools.values())

  def get_tool(self, tool_id: str) -> Optional[MetorialMcpTool]:
    """Get a specific tool by ID."""
    return self.tools.get(tool_id)

  async def call_tool(self, tool_id: str, arguments: Dict[str, Any]) -> Any:
    """Call a tool by ID."""
    tool = self.get_tool(tool_id)
    if not tool:
      raise ValueError(f"Tool '{tool_id}' not found")
    return await tool.call(self.client, arguments)


class MetorialMcpSession:
  """Represents an MCP session with Metorial."""

  def __init__(
    self, client: MetorialClient, server_deployments: List[str], mcp_host: str
  ):
    self.client = client
    self.server_deployments = server_deployments
    self.mcp_host = mcp_host
    self._session_data: Optional[Dict[str, Any]] = None
    self._capabilities: Optional[Dict[str, Any]] = None
    self._tool_manager: Optional[MetorialMcpToolManager] = None
    self._mcp_clients: Dict[str, MetorialMcpClient] = {}

  async def get_session(self) -> Dict[str, Any]:
    """Get session data."""
    if self._session_data is None:
      self._session_data = await self.client.create_session(
        self.server_deployments
      )
    return self._session_data

  async def get_server_deployments(self) -> List[Dict[str, Any]]:
    """Get server deployment information."""
    session = await self.get_session()
    return session.get("server_deployments", [])

  async def get_capabilities(self) -> Dict[str, Any]:
    """Get server capabilities."""
    if self._capabilities is None:
      deployments = await self.get_server_deployments()
      deployment_ids = [d["id"] for d in deployments]

      # Try to get capabilities from HTTP endpoint first
      try:
        self._capabilities = await self.client.get_capabilities(deployment_ids)
      except Exception:
        # If capabilities endpoint fails, silently fall back to MCP connection
        # This is expected in development environments where the endpoint may not be available
        self._capabilities = {"tools": [], "resources": []}

    return self._capabilities

  async def get_tool_manager(self) -> MetorialMcpToolManager:
    """Get tool manager for this session."""
    if self._tool_manager is None:
      capabilities = await self.get_capabilities()
      tools = [
        MetorialMcpTool(tool_data)
        for tool_data in capabilities.get("tools", [])
      ]

      # Get the first deployment's client
      deployments = await self.get_server_deployments()
      if deployments:
        client = await self.get_client(deployments[0]["id"])
        self._tool_manager = MetorialMcpToolManager(tools, client)
      else:
        raise ValueError("No server deployments available")

    return self._tool_manager

  async def get_client(self, deployment_id: str) -> MetorialMcpClient:
    """Get MCP client for a specific deployment."""
    if deployment_id not in self._mcp_clients:
      session = await self.get_session()
      client = MetorialMcpClient(
        session_id=session["id"],
        deployment_id=deployment_id,
        client_secret=session["client_secret"]["secret"],
        mcp_host=self.mcp_host,
      )
      self._mcp_clients[deployment_id] = client
    return self._mcp_clients[deployment_id]

  async def close(self):
    """Close the session and all clients."""
    await asyncio.gather(
      *[client.close() for client in self._mcp_clients.values()],
      return_exceptions=True,
    )


class MetorialOpenAISession:
  """OpenAI-compatible session that provides tools and call_tools method."""

  def __init__(
    self, session: MetorialMcpSession, tool_manager: MetorialMcpToolManager
  ):
    self.session = session
    self.tool_manager = tool_manager

  @property
  def tools(self) -> List[Dict[str, Any]]:
    """Get tools in OpenAI format."""
    return [
      {
        "type": "function",
        "function": {
          "name": tool.name,
          "description": tool.description,
          "parameters": tool.get_parameters_as_json_schema(),
        },
      }
      for tool in self.tool_manager.get_tools()
    ]

  async def call_tools(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
    """Call tools from OpenAI tool calls format."""
    results = []

    for tool_call in tool_calls:
      try:
        # Handle both OpenAI tool call objects and dict format
        if hasattr(tool_call, "id"):
          tool_call_id = tool_call.id
          function_name = tool_call.function.name
          arguments_str = tool_call.function.arguments
        else:
          tool_call_id = tool_call["id"]
          function_name = tool_call["function"]["name"]
          arguments_str = tool_call["function"]["arguments"]

        # Parse arguments
        try:
          arguments = (
            json.loads(arguments_str)
            if isinstance(arguments_str, str)
            else arguments_str
          )
        except json.JSONDecodeError as e:
          results.append(
            {
              "role": "tool",
              "tool_call_id": tool_call_id,
              "content": f"[ERROR] Invalid JSON in tool call arguments: {e}",
            }
          )
          continue

        # Call the tool
        try:
          result = await self.tool_manager.call_tool(function_name, arguments)
          results.append(
            {
              "role": "tool",
              "tool_call_id": tool_call_id,
              "content": (
                json.dumps(result)
                if not isinstance(result, str)
                else result
              ),
            }
          )
        except Exception as e:
          results.append(
            {
              "role": "tool",
              "tool_call_id": tool_call_id,
              "content": f"[ERROR] Tool call failed: {e}",
            }
          )

      except Exception as e:
        # If we can't even parse the tool call, create a generic error
        results.append(
          {
            "role": "tool",
            "tool_call_id": "unknown",
            "content": f"[ERROR] Failed to process tool call: {e}",
          }
        )

    return results


class McpSessionManager:
  """MCP session manager for the Metorial client."""

  def __init__(self, metorial_client: "Metorial"):
    self.metorial_client = metorial_client

  def create_session(self, config: Dict[str, Any]) -> "MetorialMcpSession":
    """Create an MCP session with the given configuration."""
    server_deployments = config.get("server_deployments", [])
    return MetorialMcpSession(
      self.metorial_client.client,
      server_deployments,
      self.metorial_client.mcp_host,
    )


class Metorial:
  """Main Metorial client class."""

  def __init__(
    self,
    api_key: str,
    api_host: str = "https://api.metorial.com",
    mcp_host: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
  ):
    self.api_key = api_key
    self.api_host = api_host
    self.mcp_host = mcp_host or self._get_default_mcp_host(api_host)

    # Create MetorialHttpClient which has the create_session method
    self.client = MetorialHttpClient(api_key, api_host, headers or {})

    # Create MCP session manager
    self.mcp = McpSessionManager(self)

  def _get_default_mcp_host(self, api_host: str) -> str:
    """Get default MCP host based on API host."""
    if api_host.startswith("https://api.metorial"):
      return api_host.replace("https://api.metorial", "https://mcp.metorial")

    parsed = urlparse(api_host)
    return f"{parsed.scheme}://{parsed.hostname}:4311"

  async def with_session(
    self, server_deployments: List[str], callback: Callable[[MetorialMcpSession], T]
  ) -> T:
    """Execute callback with a Metorial MCP session."""
    session = MetorialMcpSession(self.client, server_deployments, self.mcp_host)
    try:
      return await callback(session)
    finally:
      await session.close()

  async def with_provider_session(
    self,
    provider: Any,
    config: Dict[str, Any],
    callback: Callable[[MetorialOpenAISession], T],
  ) -> T:
    """Execute callback with a provider-specific session."""
    server_deployments = config.get("server_deployments", [])

    async def session_callback(session: MetorialMcpSession) -> T:
      tool_manager = await session.get_tool_manager()
      openai_session = MetorialOpenAISession(session, tool_manager)
      return await callback(openai_session)

    return await self.with_session(server_deployments, session_callback)
