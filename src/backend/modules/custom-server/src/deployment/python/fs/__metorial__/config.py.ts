export let configPy = `"""Configuration management for Metorial MCP servers."""

_global_args = {}

def set_args(args):
    """Set the global configuration arguments."""
    global _global_args
    _global_args = args

def get_args():
    """Get the global configuration arguments."""
    return _global_args
`;

