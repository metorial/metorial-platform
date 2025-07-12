"""MCP Tool implementation for Metorial Python client."""

from typing import Any, Dict, Optional
from metorial.uri_template import McpUriTemplate, slugify
from metorial.schema_utils import get_schema_format


class MetorialMcpTool:
 """Represents a tool available via MCP."""
 
 def __init__(self, session: "MetorialMcpSession", capabilities: Dict[str, Any], tool_data: Dict[str, Any], tool_type: str = 'tool'):
  self.session = session
  self.capabilities = capabilities
  self.id = slugify(tool_data['name'])
  self.name = tool_data['name']
  self.description = tool_data.get('description')
  self.input_schema = tool_data.get('inputSchema', {})
  self.tool_type = tool_type
  
  # For resource templates
  if tool_type == 'resource_template':
   self.uri_template = tool_data.get('uriTemplate', '')
   self._setup_resource_template()
  
  # Find the MCP server for this tool
  self.mcp_server = self._find_mcp_server(tool_data)
 
 def _find_mcp_server(self, tool_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
  """Find the MCP server that provides this tool."""
  mcp_server_id = tool_data.get('mcpServerId')
  if not mcp_server_id:
   return None
  
  for server in self.capabilities.get('mcpServers', []):
   if server['id'] == mcp_server_id:
    return server
  return None
 
 def _setup_resource_template(self):
  """Setup parameters for resource template based on URI template."""
  if hasattr(self, 'uri_template') and self.uri_template:
   uri = McpUriTemplate(self.uri_template)
   properties = uri.get_properties()
   
   self.input_schema = {
    'type': 'object',
    'properties': {
     prop['key']: {'type': 'string'}
     for prop in properties
    },
    'required': [
     prop['key'] for prop in properties
     if not prop.get('optional', False)
    ],
    'additionalProperties': False
   }
 
 def get_parameters_as(self, format_type: str = 'json-schema') -> Dict[str, Any]:
  """Get tool parameters in the specified format."""
  return get_schema_format(self.input_schema, format_type)
 
 def get_parameters_as_json_schema(self) -> Dict[str, Any]:
  """Get tool parameters as JSON schema."""
  return self.get_parameters_as('json-schema')
 
 async def call(self, arguments: Dict[str, Any]) -> Any:
  """Call this tool."""
  if not self.mcp_server:
   raise ValueError(f"Tool {self.name} has no MCP server available")
  
  if not self.mcp_server.get('serverDeployment'):
   raise ValueError(f"Tool {self.name} has no server deployment to run on")
  
  deployment_id = self.mcp_server['serverDeployment']['id']
  client = await self.session.get_client(deployment_id)
  
  if self.tool_type == 'resource_template':
   return await self._call_resource_template(client, arguments)
  else:
   result = await client.call_tool(self.name, arguments)
   return result.get('toolResult')
 
 async def _call_resource_template(self, client: "MetorialMcpClient", arguments: Dict[str, Any]) -> Any:
  """Call a resource template (read resource)."""
  # Expand URI template with arguments
  uri = McpUriTemplate(self.uri_template)
  expanded_uri = uri.expand(arguments)
  
  # Call read_resource via MCP client
  result = await client.read_resource(expanded_uri)
  return result.get('contents')
 
 @classmethod
 def from_tool(cls, session: "MetorialMcpSession", capabilities: Dict[str, Any], tool_data: Dict[str, Any]) -> 'MetorialMcpTool':
  """Create tool from tool data."""
  return cls(session, capabilities, tool_data, 'tool')
 
 @classmethod
 def from_resource_template(cls, session: "MetorialMcpSession", capabilities: Dict[str, Any], template_data: Dict[str, Any]) -> 'MetorialMcpTool':
  """Create tool from resource template data."""
  return cls(session, capabilities, template_data, 'resource_template')
