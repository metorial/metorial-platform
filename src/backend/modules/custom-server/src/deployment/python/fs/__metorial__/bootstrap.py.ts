export let bootstrapPy = `
import asyncio
import sys
import os
import importlib.util
import builtins
from typing import Any, Dict

from __metorial__ import config
from __metorial__ import oauth
from __metorial__ import callbacks

_user_module_loaded = False
_server = None
_handlers = {}

def load_user_server(args: Dict[str, Any]):
    global _user_module_loaded, _server, _handlers
    
    config.set_args(args)
    
    if not _user_module_loaded:
        entrypoint = os.environ.get('METORIAL_ENTRYPOINT', 'server.py')
        
        module_name = entrypoint.replace('.py', '').replace('/', '.')
        spec = importlib.util.spec_from_file_location(module_name, entrypoint)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            _user_module_loaded = True
    
    _server = getattr(builtins, '__metorial_server__', None)
    if _server is None:
        raise RuntimeError("No MCP server found. Did you call metorial.create_server()?")
    
    _handlers = getattr(builtins, '__metorial_handlers__', {})
    
    return _server, _handlers

async def handle_discover(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        args = event.get('args', {})
        server, handlers = load_user_server(args)
        
        tools = []
        resource_templates = []
        prompts = []
        
        if 'list_tools' in handlers:
            tools_result = await handlers['list_tools']()
            if tools_result:
                tools = tools_result if isinstance(tools_result, list) else []
        
        if 'list_resources' in handlers:
            resources_result = await handlers['list_resources']()
            if resources_result:
                resource_templates = resources_result if isinstance(resources_result, list) else []
        
        if 'list_prompts' in handlers:
            prompts_result = await handlers['list_prompts']()
            if prompts_result:
                prompts = prompts_result if isinstance(prompts_result, list) else []
        
        return {
            "success": True,
            "discovery": {
                "tools": tools,
                "resourceTemplates": resource_templates,
                "prompts": prompts,
                "capabilities": {},
                "implementation": {
                    "name": server.name if hasattr(server, 'name') else "unknown",
                    "version": "1.0.0"
                },
                "instructions": None
            }
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": {
                "code": "discovery_error",
                "message": str(e) + "\\n" + traceback.format_exc()
            }
        }

async def handle_mcp_request(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        args = event.get('args', {})
        server, handlers = load_user_server(args)
        messages = event.get('messages', [])
        
        responses = []
        for message in messages:
            try:
                method = message.get('method', '')
                params = message.get('params', {})
                
                if method == 'tools/call':
                    if 'call_tool' in handlers:
                        name = params.get('name')
                        arguments = params.get('arguments', {})
                        result = await handlers['call_tool'](name, arguments)
                        responses.append({
                            "jsonrpc": "2.0",
                            "id": message.get('id'),
                            "result": result
                        })
                    else:
                        raise ValueError("call_tool handler not registered")
                
                elif method == 'resources/read':
                    if 'read_resource' in handlers:
                        uri = params.get('uri')
                        result = await handlers['read_resource'](uri)
                        responses.append({
                            "jsonrpc": "2.0",
                            "id": message.get('id'),
                            "result": result
                        })
                    else:
                        raise ValueError("read_resource handler not registered")
                
                elif method == 'prompts/get':
                    if 'get_prompt' in handlers:
                        name = params.get('name')
                        arguments = params.get('arguments', {})
                        result = await handlers['get_prompt'](name, arguments)
                        responses.append({
                            "jsonrpc": "2.0",
                            "id": message.get('id'),
                            "result": result
                        })
                    else:
                        raise ValueError("get_prompt handler not registered")
                
                else:
                    responses.append({
                        "jsonrpc": "2.0",
                        "id": message.get('id'),
                        "error": {
                            "code": -32601,
                            "message": f"Method not found: {method}"
                        }
                    })
            
            except Exception as e:
                responses.append({
                    "jsonrpc": "2.0",
                    "id": message.get('id'),
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                })
        
        return {
            "success": True,
            "responses": responses
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": {
                "code": "mcp_error",
                "message": str(e) + "\\n" + traceback.format_exc()
            }
        }

async def handle_oauth_action(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        load_user_server({})
        
        oauth_action = event.get('oauthAction')
        oauth_input = event.get('oauthInput', {})
        
        if oauth_action == 'get':
            result = await oauth.handle_oauth_get()
            return {"success": True, "oauth": result}
        elif oauth_action == 'authorization-url':
            result = await oauth.handle_oauth_authorization_url(oauth_input)
            return {"success": True, "oauth": result}
        elif oauth_action == 'authorization-form':
            result = await oauth.handle_oauth_authorization_form(oauth_input)
            return {"success": True, "oauth": result}
        elif oauth_action == 'callback':
            result = await oauth.handle_oauth_callback(oauth_input)
            return {"success": True, "oauth": result}
        elif oauth_action == 'refresh':
            result = await oauth.handle_oauth_refresh(oauth_input)
            return {"success": True, "oauth": result}
        else:
            raise ValueError(f"Unknown OAuth action: {oauth_action}")
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": {
                "code": "oauth_error",
                "message": str(e) + "\\n" + traceback.format_exc()
            }
        }

async def handle_callbacks_action(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        load_user_server({})
        
        callback_action = event.get('callbackAction')
        callback_input = event.get('callbackInput', {})
        
        if callback_action == 'get':
            result = await callbacks.handle_callbacks_get()
            return {"success": True, "callbacks": result}
        elif callback_action == 'handle':
            result = await callbacks.handle_callbacks_handle(callback_input)
            return {"success": True, "callbacks": result}
        elif callback_action == 'install':
            result = await callbacks.handle_callbacks_install(callback_input)
            return {"success": True, "callbacks": result}
        elif callback_action == 'poll':
            result = await callbacks.handle_callbacks_poll(callback_input)
            return {"success": True, "callbacks": result}
        else:
            raise ValueError(f"Unknown callback action: {callback_action}")
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": {
                "code": "callback_error",
                "message": str(e) + "\\n" + traceback.format_exc()
            }
        }
`;
