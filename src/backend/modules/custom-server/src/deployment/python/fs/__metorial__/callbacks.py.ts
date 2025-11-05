export let callbacksPy = `"""Callback handling for Metorial MCP servers."""
from typing import Any, Dict, Optional, Callable, List

_callback_handler = None

class CallbackHandler:
    """Callback handler interface."""
    def __init__(self,
                 handle_hook: Callable,
                 install_hook: Optional[Callable] = None,
                 poll_hook: Optional[Callable] = None):
        self.handle_hook = handle_hook
        self.install_hook = install_hook
        self.poll_hook = poll_hook

def set_callbacks(handler: CallbackHandler):
    """Register the callback handler."""
    global _callback_handler
    _callback_handler = handler

def get_callbacks() -> Optional[CallbackHandler]:
    """Get the registered callback handler."""
    return _callback_handler

async def handle_callbacks_get() -> Dict[str, Any]:
    """Handle callbacks get request."""
    callbacks = get_callbacks()
    if not callbacks:
        return {"enabled": False}
    
    callback_type = "manual"
    if callbacks.install_hook:
        callback_type = "webhook"
    elif callbacks.poll_hook:
        callback_type = "polling"
    
    return {"enabled": True, "type": callback_type}

async def handle_callbacks_handle(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle callbacks handle request."""
    callbacks = get_callbacks()
    if not callbacks:
        raise ValueError("Callbacks not configured")
    
    callback_id = input_data.get("callbackId")
    events = input_data.get("events", [])
    
    results = []
    for event in events:
        try:
            result = await callbacks.handle_hook({
                "callbackId": callback_id,
                "eventId": event.get("eventId"),
                "payload": event.get("payload")
            })
            results.append({
                "success": True,
                "eventId": event.get("eventId"),
                "result": result
            })
        except Exception as e:
            results.append({
                "success": False,
                "eventId": event.get("eventId"),
                "error": str(e)
            })
    
    return {"results": results}

async def handle_callbacks_install(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle callbacks install request."""
    callbacks = get_callbacks()
    if not callbacks or not callbacks.install_hook:
        raise ValueError("Callback installation not supported")
    
    await callbacks.install_hook(input_data)
    return {"success": True}

async def handle_callbacks_poll(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle callbacks poll request."""
    callbacks = get_callbacks()
    if not callbacks or not callbacks.poll_hook:
        raise ValueError("Callback polling not supported")
    
    callback_id = input_data.get("callbackId")
    state = input_data.get("state")
    
    state_ref = {"current": state}
    
    def set_state(new_state):
        state_ref["current"] = new_state
    
    events = await callbacks.poll_hook({
        "callbackId": callback_id,
        "state": state,
        "setState": set_state
    })
    
    if not isinstance(events, list):
        events = [events] if events else []
    
    return {"events": events, "newState": state_ref["current"]}
`;

