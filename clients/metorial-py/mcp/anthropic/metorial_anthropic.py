"""Anthropic integration for Metorial MCP tools."""

import json
from typing import Any, Dict, List
from ...packages.mcp_sdk_utils import create_mcp_sdk


async def _anthropic_handler(context: Dict[str, Any]) -> Dict[str, Any]:
 """Handler for Anthropic integration."""
 tools = context['tools']
 
 # Format tools for Anthropic
 anthropic_tools = []
 for tool in tools.get_tools():
  anthropic_tools.append({
   'name': tool.id,
   'description': tool.description or '',
   'input_schema': tool.get_parameters_as('json-schema')
  })
 
 async def call_tools(tool_calls: List[Any]) -> List[Dict[str, Any]]:
  """Call tools from Anthropic tool use blocks."""
  results = []
  
  for call in tool_calls:
   try:
    # Handle both Anthropic tool use objects and dict format
    if hasattr(call, 'id'):
     call_id = call.id
     tool_name = call.name
     tool_input = call.input
    else:
     call_id = call['id']
     tool_name = call['name']
     tool_input = call['input']
    
    # Find the tool
    tool = tools.get_tool(tool_name)
    if not tool:
     results.append({
      'type': 'tool_result',
      'tool_use_id': call_id,
      'content': f'[ERROR] Tool with name "{tool_name}" not found.'
     })
     continue
    
    # Parse input data
    try:
     if isinstance(tool_input, str):
      data = json.loads(tool_input)
     else:
      data = tool_input
    except (json.JSONDecodeError, TypeError) as e:
     results.append({
      'type': 'tool_result',
      'tool_use_id': call_id,
      'content': f'[ERROR] Invalid JSON in tool call arguments: {e}'
     })
     continue
    
    # Call the tool
    try:
     result = await tool.call(data)
     results.append({
      'type': 'tool_result',
      'tool_use_id': call_id,
      'content': json.dumps(result) if not isinstance(result, str) else result
     })
    except Exception as e:
     results.append({
      'type': 'tool_result',
      'tool_use_id': call_id,
      'content': f'[ERROR] Tool call failed: {e}'
     })
   
   except Exception as e:
    # If we can't even parse the tool call, create a generic error
    results.append({
     'type': 'tool_result',
     'tool_use_id': getattr(call, 'id', 'unknown'),
     'content': f'[ERROR] Failed to process tool call: {e}'
    })
  
  return results
 
 return {
  'tools': anthropic_tools,
  'call_tools': call_tools
 }


# Create the MCP SDK instance
metorial_anthropic = create_mcp_sdk()(_anthropic_handler)
