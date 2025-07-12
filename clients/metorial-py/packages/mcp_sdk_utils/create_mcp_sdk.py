"""Create MCP SDK utility for Metorial Python client."""

from typing import Any, Callable, Dict, TypeVar, Generic, Awaitable
from mcp.mcp_session import MetorialMcpSession
from metorial import Metorial

T = TypeVar("T")


def create_mcp_sdk():
  """Create an MCP SDK factory function."""

  def sdk_factory(
    handler: Callable[[Dict[str, Any]], Awaitable[T]]
  ) -> "McpSdkFunction[T]":
    """Create an MCP SDK function from a handler."""
    return McpSdkFunction(handler)

  return sdk_factory


class McpSdkFunction(Generic[T]):
  """Represents an MCP SDK function that can be called with different input types."""

  def __init__(self, handler: Callable[[Dict[str, Any]], Awaitable[T]]):
    self.handler = handler

  async def of_session(
    self, session: MetorialMcpSession, input_data: Any = None
  ) -> T:
    """Execute the handler with a session and optional input."""
    tools = await session.get_tool_manager()

    context = {"session": session, "tools": tools, "input": input_data}

    return await self.handler(context)

  async def of_sdk(
    self, sdk: "Metorial", config: Dict[str, Any], input_data: Any = None
  ) -> T:
    """Execute the handler with an SDK, config, and optional input."""

    session = sdk.mcp.create_session(config)
    return await self.of_session(session, input_data)

  def __call__(self, *args, **kwargs):
    """Make the function callable directly."""
    if len(args) == 2:  # of_session call
      return self.of_session(args[0], args[1] if len(args) > 1 else None)
    elif len(args) == 3:  # of_sdk call
      return self.of_sdk(args[0], args[1], args[2] if len(args) > 2 else None)
    else:
      raise ValueError("Invalid number of arguments")
