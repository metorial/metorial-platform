export let oauthPy = `"""OAuth handling for Metorial MCP servers."""
from typing import Any, Dict, Optional, Callable, List

_oauth_handler = None

class OAuthHandler:
    """OAuth handler interface."""
    
    def __init__(self,
                 get_authorization_url: Callable,
                 handle_callback: Callable,
                 get_auth_form: Optional[Callable] = None,
                 refresh_access_token: Optional[Callable] = None):
        self.get_authorization_url = get_authorization_url
        self.handle_callback = handle_callback
        self.get_auth_form = get_auth_form
        self.refresh_access_token = refresh_access_token

def set_oauth(handler: OAuthHandler):
    """Register the OAuth handler."""
    global _oauth_handler
    _oauth_handler = handler

def get_oauth() -> Optional[OAuthHandler]:
    """Get the registered OAuth handler."""
    return _oauth_handler

async def handle_oauth_get() -> Dict[str, Any]:
    """Handle OAuth get request."""
    oauth = get_oauth()
    if not oauth:
        return {"enabled": False, "hasForm": False}
    return {"enabled": True, "hasForm": oauth.get_auth_form is not None}

async def handle_oauth_authorization_url(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle OAuth authorization URL request."""
    oauth = get_oauth()
    if not oauth:
        raise ValueError("OAuth not configured")
    
    result = await oauth.get_authorization_url(input_data)
    if isinstance(result, str):
        return {"authorizationUrl": result, "codeVerifier": ""}
    return result

async def handle_oauth_authorization_form(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle OAuth authorization form request."""
    oauth = get_oauth()
    if not oauth or not oauth.get_auth_form:
        raise ValueError("OAuth form not available")
    
    form = await oauth.get_auth_form(input_data)
    return {"authForm": form}

async def handle_oauth_callback(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle OAuth callback request."""
    oauth = get_oauth()
    if not oauth:
        raise ValueError("OAuth not configured")
    
    auth_data = await oauth.handle_callback(input_data)
    return {"authData": auth_data}

async def handle_oauth_refresh(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle OAuth token refresh request."""
    oauth = get_oauth()
    if not oauth or not oauth.refresh_access_token:
        raise ValueError("OAuth refresh not supported")
    
    auth_data = await oauth.refresh_access_token(input_data)
    return {"authData": auth_data}
`;

