export let metorialPy = `from typing import Any, Callable, Dict, Optional, List
from mcp.server import Server
from __metorial__ import config
from __metorial__ import oauth as oauth_module
from __metorial__ import callbacks as callbacks_module

_global_server = None
_global_handlers = {}

def get_args():
    """Get configuration arguments passed to the server."""
    return config.get_args()

def set_oauth_handler(
    get_authorization_url,
    handle_callback,
    get_auth_form=None,
    refresh_access_token=None
):
    """Register an OAuth handler for the server."""
    if get_authorization_url is None:
        raise ValueError("get_authorization_url is required")
    if handle_callback is None:
        raise ValueError("handle_callback is required")
    
    handler = oauth_module.OAuthHandler(
        get_authorization_url=get_authorization_url,
        handle_callback=handle_callback,
        get_auth_form=get_auth_form,
        refresh_access_token=refresh_access_token
    )
    oauth_module.set_oauth(handler)

def set_callback_handler(
    handle,
    install=None,
    poll=None
):
    """Register a callback handler for the server."""
    if handle is None:
        raise ValueError("handle is required")
    
    handler = callbacks_module.CallbackHandler(
        handle_hook=handle,
        install_hook=install,
        poll_hook=poll
    )
    callbacks_module.set_callbacks(handler)

def create_server(name, version="1.0.0"):
    """Create a Metorial MCP server."""
    global _global_server, _global_handlers
    
    server = Server(name)
    _global_server = server
    
    # Store server in global state for bootstrap to find
    import builtins
    builtins.__metorial_server__ = server
    builtins.__metorial_handlers__ = _global_handlers
    
    # Wrap decorators to capture handler functions
    original_list_tools = server.list_tools
    original_call_tool = server.call_tool
    original_list_resources = server.list_resources
    original_read_resource = server.read_resource
    original_list_prompts = server.list_prompts
    original_get_prompt = server.get_prompt
    
    def list_tools():
        def decorator(func):
            _global_handlers['list_tools'] = func
            return original_list_tools()(func)
        return decorator
    
    def call_tool():
        def decorator(func):
            _global_handlers['call_tool'] = func
            return original_call_tool()(func)
        return decorator
    
    def list_resources():
        def decorator(func):
            _global_handlers['list_resources'] = func
            return original_list_resources()(func)
        return decorator
    
    def read_resource():
        def decorator(func):
            _global_handlers['read_resource'] = func
            return original_read_resource()(func)
        return decorator
    
    def list_prompts():
        def decorator(func):
            _global_handlers['list_prompts'] = func
            return original_list_prompts()(func)
        return decorator
    
    def get_prompt():
        def decorator(func):
            _global_handlers['get_prompt'] = func
            return original_get_prompt()(func)
        return decorator
    
    server.list_tools = list_tools
    server.call_tool = call_tool
    server.list_resources = list_resources
    server.read_resource = read_resource
    server.list_prompts = list_prompts
    server.get_prompt = get_prompt
    
    return server

def start_server(server):
    """Start the MCP server (no-op in Lambda, kept for API compatibility)."""
    pass

__all__ = [
    'create_server',
    'start_server', 
    'get_args',
    'set_oauth_handler',
    'set_callback_handler'
]
`;
