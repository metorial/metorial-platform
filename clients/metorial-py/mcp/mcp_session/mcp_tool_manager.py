"""MCP Tool Manager for Metorial Python client."""

from typing import Any, Dict, List, Optional
from .mcp_tool import MetorialMcpTool


class MetorialMcpToolManager:
 """Manages tools available in an MCP session."""
 
 def __init__(self, session: "MetorialMcpSession", tools: List[MetorialMcpTool]):
  self.session = session
  self.tools = {}
  
  for tool in tools:
   self.tools[tool.id] = tool
   self.tools[tool.name] = tool
 
 def get_tools(self) -> List[MetorialMcpTool]:
  """Get all available tools."""
  # Return unique tools (since we store by both id and name)
  seen = set()
  result = []
  for tool in self.tools.values():
   if tool.id not in seen:
    seen.add(tool.id)
    result.append(tool)
  return result
 
 def get_tool(self, tool_id_or_name: str) -> Optional[MetorialMcpTool]:
  """Get a specific tool by ID or name."""
  return self.tools.get(tool_id_or_name)
 
 async def call_tool(self, tool_id_or_name: str, arguments: Dict[str, Any]) -> Any:
  """Call a tool by ID or name."""
  tool = self.get_tool(tool_id_or_name)
  if not tool:
   raise ValueError(f"Tool '{tool_id_or_name}' not found")
  return await tool.call(arguments)
 
 @classmethod
 async def from_capabilities(cls, session: "MetorialMcpSession", capabilities: Dict[str, Any]) -> 'MetorialMcpToolManager':
  """Create tool manager from capabilities."""
  tools = []
  
  # Add regular tools
  for tool_data in capabilities.get('tools', []):
   tools.append(MetorialMcpTool.from_tool(session, capabilities, tool_data))
  
  # Add resource template tools
  for template_data in capabilities.get('resourceTemplates', []):
   tools.append(MetorialMcpTool.from_resource_template(session, capabilities, template_data))
  
  return cls(session, tools)
