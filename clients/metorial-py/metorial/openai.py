"""
Metorial OpenAI Provider

Integration between Metorial and OpenAI's Python SDK.
"""

from typing import Any, Dict, List


class MetorialOpenAIProvider:
  """Provider for OpenAI integration with Metorial."""

  @property
  def chat_completions(self) -> str:
    """Provider identifier for OpenAI chat completions."""
    return "openai-chat-completions"

  def format_tools(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format Metorial tools for OpenAI API."""
    # Convert Metorial MCP tool definitions to OpenAI function calling format
    return tools

  def format_tool_calls(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
    """Format OpenAI tool calls for Metorial."""
    # Convert OpenAI tool calls to Metorial MCP tool call format
    formatted_calls = []
    for call in tool_calls:
      formatted_calls.append(
        {
          "id": getattr(call, "id", ""),
          "type": getattr(call, "type", "function"),
          "function": {
            "name": getattr(call.function, "name", ""),
            "arguments": getattr(call.function, "arguments", "{}"),
          },
        }
      )
    return formatted_calls


# Create singleton instance
metorial_openai = MetorialOpenAIProvider()
