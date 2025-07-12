"""OpenAI integration for Metorial Python client."""

import json
from typing import Any, Dict, List
from packages.mcp_sdk_utils import create_mcp_sdk


async def _openai_handler(context: Dict[str, Any]) -> Dict[str, Any]:
 """Handler for OpenAI integration."""
 tools = context['tools']
 
 # Format tools for OpenAI
 openai_tools = []
 for tool in tools.get_tools():
  openai_tools.append({
   'type': 'function',
   'name': tool.id,
   'description': tool.description or '',
   'parameters': tool.get_parameters_as('json-schema')
  })

 async def call_tools(tool_calls: List[Any]) -> List[Dict[str, Any]]:
  """Call tools from OpenAI function call format."""
  results = []
  
  for call in tool_calls:
   try:
    # Handle both OpenAI tool call objects and dict format
    if hasattr(call, 'call_id'):
     call_id = call.call_id
     function_name = call.function.name
     arguments_str = call.function.arguments
    else:
     call_id = call['call_id']
     function_name = call['function']['name']
     arguments_str = call['function']['arguments']

    # Parse arguments
    try:
     arguments = json.loads(arguments_str) if isinstance(arguments_str, str) else arguments_str
    except json.JSONDecodeError as e:
     results.append({
      'call_id': call_id,
      'type': 'function_call_output',
      'output': f'[ERROR] Invalid JSON in tool call arguments: {e}'
     })
     continue

    # Call the tool
    try:
     result = await tools.call_tool(function_name, arguments)
     results.append({
      'call_id': call_id,
      'type': 'function_call_output',
      'output': json.dumps(result) if not isinstance(result, str) else result
     })
    except Exception as e:
     results.append({
      'call_id': call_id,
      'type': 'function_call_output',
      'output': f'[ERROR] Tool call failed: {e}'
     })

   except Exception as e:
    # If we can't even parse the tool call, create a generic error
    results.append({
     'call_id': getattr(call, 'call_id', 'unknown'),
     'type': 'function_call_output',
     'output': f'[ERROR] Failed to process tool call: {e}'
    })
  
  return results

 return {
  'tools': openai_tools,
  'call_tools': call_tools
 }


# Create the MCP SDK instance
metorial_openai = create_mcp_sdk()(_openai_handler)
