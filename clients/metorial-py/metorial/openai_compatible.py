"""
Metorial OpenAI-Compatible Providers

Providers for services that use OpenAI-compatible APIs like DeepSeek, TogetherAI, and XAI.
"""

import json
from typing import Any, Dict, List


class MetorialOpenAICompatibleProvider:
  """Base provider for OpenAI-compatible APIs."""

  def __init__(self, provider_name: str, with_strict: bool = False):
    self.provider_name = provider_name
    self.with_strict = with_strict

  @property
  def chat_completions(self) -> str:
    """Provider identifier for chat completions."""
    return f"{self.provider_name}-chat-completions"

  def format_tools(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format Metorial tools for OpenAI-compatible API."""
    formatted_tools = []
    for tool in tools:
      tool_def = {
        "type": "function",
        "function": {
          "name": tool["name"],
          "description": tool.get("description"),
          "parameters": tool.get("input_schema", {}),
        },
      }
      if self.with_strict:
        tool_def["function"]["strict"] = True
      formatted_tools.append(tool_def)
    return formatted_tools

  def format_tool_calls(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
    """Format OpenAI-compatible tool calls for Metorial."""
    formatted_calls = []
    for call in tool_calls:
      formatted_calls.append(
        {
          "id": getattr(call, "id", ""),
          "type": getattr(call, "type", "function"),
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
    """Call tools and return OpenAI-compatible response."""
    results = []

    for call in tool_calls:
      try:
        # Handle both OpenAI tool call objects and dict format
        if hasattr(call, "id"):
          tool_call_id = call.id
          function_name = call.function.name
          arguments_str = call.function.arguments
        else:
          tool_call_id = call["id"]
          function_name = call["function"]["name"]
          arguments_str = call["function"]["arguments"]

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
          result = await tool_manager.call_tool(function_name, arguments)
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


# Create provider instances
metorial_deepseek = MetorialOpenAICompatibleProvider("deepseek", with_strict=False)
metorial_togetherai = MetorialOpenAICompatibleProvider("togetherai", with_strict=False)
metorial_xai = MetorialOpenAICompatibleProvider("xai", with_strict=True)
