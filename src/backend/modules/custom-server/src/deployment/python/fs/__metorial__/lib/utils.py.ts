export let utilsPy = `"""Utility functions for Metorial MCP servers."""
import json
import traceback
from typing import Any, Dict

def format_error(error: Exception) -> Dict[str, str]:
    """Format an exception into a standard error dict."""
    return {
        "code": type(error).__name__,
        "message": str(error)
    }

def safe_json_dumps(obj: Any) -> str:
    """Safely serialize an object to JSON."""
    try:
        return json.dumps(obj)
    except Exception as e:
        return json.dumps({"error": f"Serialization failed: {str(e)}"})

def get_traceback() -> str:
    """Get the current exception traceback as a string."""
    return traceback.format_exc()
`;

