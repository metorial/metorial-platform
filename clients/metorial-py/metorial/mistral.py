"""
Metorial Mistral Provider

Integration between Metorial and Mistral's Python SDK.
"""

import json
from typing import Any, Dict, List


class MetorialMistralProvider:
  """Provider for Mistral integration with Metorial."""

  @property
  def chat_completions(self) -> str:
    """Provider identifier for Mistral chat completions."""
    return "mistral-chat-completions"

  def format_tools(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format Metorial tools for Mistral API."""
    return [
      {
        "type": "function",
        "function": {
          "name": tool["name"],
          "description": tool.get("description"),
          "parameters": tool.get("input_schema", {}),
          "strict": True,
        },
      }
      for tool in tools
    ]

  def format_tool_calls(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
    """Format Mistral tool calls for Metorial."""
    formatted_calls = []
    for call in tool_calls:
      formatted_calls.append(
        {
          "id": getattr(call, "id", ""),
          "function": {
            "name": (
              getattr(call.function, "name", "")
              if hasattr(call, "function")
              else ""
            ),
            "arguments": (
              getattr(call.function, "arguments", "")
              if hasattr(call, "function")
              else ""
            ),
          },
        }
      )
    return formatted_calls

  async def call_tools(
    self, tool_manager, tool_calls: List[Any]
  ) -> List[Dict[str, Any]]:
    """Call tools and return Mistral-formatted response."""
    results = []

    for call in tool_calls:
      try:
        call_id = getattr(call, "id", "")
        function = getattr(call, "function", None)

        if function:
          function_name = getattr(function, "name", "")
          arguments_str = getattr(function, "arguments", "")
        else:
          function_name = ""
          arguments_str = ""

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
              "tool_call_id": call_id,
              "role": "tool",
              "content": f"[ERROR] Invalid JSON in tool call arguments: {e}",
            }
          )
          continue

        # Call the tool
        try:
          result = await tool_manager.call_tool(function_name, arguments)
          results.append(
            {
              "tool_call_id": call_id,
              "role": "tool",
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
              "tool_call_id": call_id,
              "role": "tool",
              "content": f"[ERROR] Tool call failed: {e}",
            }
          )

      except Exception as e:
        results.append(
          {
            "tool_call_id": "unknown",
            "role": "tool",
            "content": f"[ERROR] Failed to process tool call: {e}",
          }
        )

    return results


# Create singleton instance
metorial_mistral = MetorialMistralProvider()
