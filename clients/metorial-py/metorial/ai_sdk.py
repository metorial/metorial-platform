"""
Metorial AI SDK Provider

Integration for AI SDK frameworks in Python.
"""

from typing import Any, Callable, Dict, List


class MetorialAiTool:
  """Represents a tool in AI SDK format."""

  def __init__(
    self,
    tool_id: str,
    description: str,
    parameters: Dict[str, Any],
    execute_fn: Callable,
  ):
    self.id = tool_id
    self.description = description
    self.parameters = parameters
    self.execute = execute_fn


class MetorialAiSdkProvider:
  """Provider for AI SDK integration with Metorial."""

  @property
  def tools_dict(self) -> str:
    """Provider identifier for AI SDK tools."""
    return "ai-sdk-tools"

  def format_tools(
    self, tools: List[Dict[str, Any]], tool_manager
  ) -> Dict[str, MetorialAiTool]:
    """Format Metorial tools for AI SDK."""
    tools_dict = {}

    for tool in tools:
      tool_id = tool["name"]
      description = tool.get("description")
      parameters = tool.get("input_schema", {})

      # Create execute function that calls the tool through tool_manager
      async def create_execute_fn(tool_name):
        async def execute(params):
          return await tool_manager.call_tool(tool_name, params)

        return execute

      tools_dict[tool_id] = MetorialAiTool(
        tool_id=tool_id,
        description=description,
        parameters=parameters,
        execute_fn=create_execute_fn(tool_id),
      )

    return tools_dict

  async def execute_tool(self, tool: MetorialAiTool, params: Dict[str, Any]) -> Any:
    """Execute a single AI SDK tool."""
    return await tool.execute(params)


# Create singleton instance
metorial_ai_sdk = MetorialAiSdkProvider()
