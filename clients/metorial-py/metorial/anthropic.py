"""
Metorial Anthropic Provider

Integration between Metorial and Anthropic's Python SDK.
"""

import json
from typing import Any, Dict, List


class MetorialAnthropicProvider:
  """Provider for Anthropic integration with Metorial."""

  @property
  def chat_completions(self) -> str:
    """Provider identifier for Anthropic chat completions."""
    return "anthropic-chat-completions"

  def format_tools(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format Metorial tools for Anthropic API."""
    return [
      {
        "name": tool["name"],
        "description": tool.get("description"),
        "input_schema": tool.get("input_schema", {}),
      }
      for tool in tools
    ]

  def format_tool_calls(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
    """Format Anthropic tool calls for Metorial."""
    formatted_calls = []
    for call in tool_calls:
      formatted_calls.append(
        {
          "id": getattr(call, "id", ""),
          "name": getattr(call, "name", ""),
          "input": getattr(call, "input", {}),
        }
      )
    return formatted_calls

  async def call_tools(self, tool_manager, tool_calls: List[Any]) -> Dict[str, Any]:
    """Call tools and return Anthropic-formatted response."""
    content = []

    for call in tool_calls:
      try:
        tool_id = getattr(call, "name", "")
        tool_input = getattr(call, "input", {})
        call_id = getattr(call, "id", "")

        # Parse input if it's a string
        if isinstance(tool_input, str):
          try:
            tool_input = json.loads(tool_input)
          except json.JSONDecodeError as e:
            content.append(
              {
                "type": "tool_result",
                "tool_use_id": call_id,
                "content": f"[ERROR] Invalid JSON in tool call arguments: {e}",
              }
            )
            continue

        # Call the tool
        try:
          result = await tool_manager.call_tool(tool_id, tool_input)
          content.append(
            {
              "type": "tool_result",
              "tool_use_id": call_id,
              "content": (
                json.dumps(result)
                if not isinstance(result, str)
                else result
              ),
            }
          )
        except Exception as e:
          content.append(
            {
              "type": "tool_result",
              "tool_use_id": call_id,
              "content": f"[ERROR] Tool call failed: {e}",
            }
          )

      except Exception as e:
        content.append(
          {
            "type": "tool_result",
            "tool_use_id": "unknown",
            "content": f"[ERROR] Failed to process tool call: {e}",
          }
        )

    return {"role": "user", "content": content}


# Create singleton instance
metorial_anthropic = MetorialAnthropicProvider()
