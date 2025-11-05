export let indexPy = `
import json
import asyncio
from typing import Any, Dict

from __metorial__ import bootstrap

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
  action = event.get('action')
  
  try:
    loop = asyncio.get_event_loop()
    if loop.is_running():
      loop = asyncio.new_event_loop()
      asyncio.set_event_loop(loop)
    
    if action == 'discover':
      result = loop.run_until_complete(bootstrap.handle_discover(event))
    elif action == 'mcp.request' or action == 'mcp.batch':
      result = loop.run_until_complete(bootstrap.handle_mcp_request(event))
    elif action == 'oauth':
      result = loop.run_until_complete(bootstrap.handle_oauth_action(event))
    elif action == 'callbacks':
      result = loop.run_until_complete(bootstrap.handle_callbacks_action(event))
    else:
      result = {
        "success": False,
        "error": {
          "code": "unknown_action",
          "message": f"Unknown action: {action}"
        }
      }
      
    return result
  except Exception as e:
    import traceback
    return {
      "success": False,
      "error": {
        "code": "handler_error",
        "message": str(e) + "\\n" + traceback.format_exc()
      }
    }

if __name__ == "__main__":
  test_event = {
    "action": "discover",
    "args": {}
  }
  result = lambda_handler(test_event, None)
  print(json.dumps(result, indent=2))
`;

