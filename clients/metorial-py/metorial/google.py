"""
Metorial Google Provider

Integration between Metorial and Google's Generative AI Python SDK.
"""

import json
from typing import Any, Dict, List


class MetorialGoogleProvider:
  """Provider for Google Generative AI integration with Metorial."""

  @property
  def chat_completions(self) -> str:
    """Provider identifier for Google chat completions."""
    return "google-chat-completions"

  def format_tools(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format Metorial tools for Google Generative AI API."""
    return [
      {
        "function_declarations": [
          {
            "name": tool["name"],
            "description": tool.get("description"),
            "parameters": tool.get("input_schema", {}),
          }
          for tool in tools
        ]
      }
    ]

  def format_tool_calls(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
    """Format Google tool calls for Metorial."""
    formatted_calls = []
    for call in tool_calls:
      formatted_calls.append(
        {
          "id": getattr(call, "id", ""),
          "name": getattr(call, "name", ""),
          "args": getattr(call, "args", {}),
        }
      )
    return formatted_calls

  async def call_tools(self, tool_manager, tool_calls: List[Any]) -> Dict[str, Any]:
    """Call tools and return Google-formatted response."""
    parts = []

    for call in tool_calls:
      try:
        tool_name = getattr(call, "name", "")
        tool_args = getattr(call, "args", {})
        call_id = getattr(call, "id", "")

        # Parse args if it's a string
        if isinstance(tool_args, str):
          try:
            tool_args = json.loads(tool_args)
          except json.JSONDecodeError as e:
            parts.append(
              {
                "function_response": {
                  "id": call_id,
                  "name": tool_name,
                  "response": {
                    "error": f"[ERROR] Invalid JSON in tool call arguments: {e}"
                  },
                }
              }
            )
            continue

        # Call the tool
        try:
          result = await tool_manager.call_tool(tool_name, tool_args)
          parts.append(
            {
              "function_response": {
                "id": call_id,
                "name": tool_name,
                "response": result,
              }
            }
          )
        except Exception as e:
          parts.append(
            {
              "function_response": {
                "id": call_id,
                "name": tool_name,
                "response": {"error": f"[ERROR] Tool call failed: {e}"},
              }
            }
          )

      except Exception as e:
        parts.append(
          {
            "function_response": {
              "id": "unknown",
              "name": "unknown",
              "response": {
                "error": f"[ERROR] Failed to process tool call: {e}"
              },
            }
          }
        )

    return {"role": "user", "parts": parts}


# Create singleton instance
metorial_google = MetorialGoogleProvider()
