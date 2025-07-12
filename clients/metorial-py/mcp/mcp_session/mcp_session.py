"""MCP Session implementation for Metorial Python client."""

import asyncio
from typing import Any, Dict, List, Optional
from .mcp_client import MetorialMcpClient
from .mcp_tool_manager import MetorialMcpToolManager


class MetorialMcpSession:
 """Represents an MCP session with Metorial."""
 
 def __init__(self, sdk: "MetorialCoreSDK", config: Dict[str, Any]):
  self._sdk = sdk
  self.config = config
  self._session_promise: Optional[asyncio.Task] = None
  self._client_promises: Dict[str, asyncio.Task] = {}
  
  # Initialize session creation
  self._session_promise = asyncio.create_task(self._sdk.sessions.create(config))
 
 async def get_session(self) -> "MetorialSession":
  """Get session data."""
  if self._session_promise is None:
   self._session_promise = asyncio.create_task(self._sdk.sessions.create(self.config))
  return await self._session_promise
 
 async def get_server_deployments(self) -> List[Dict[str, Any]]:
  """Get server deployment information."""
  session = await self.get_session()
  return session.server_deployments
 
 async def get_capabilities(self) -> Dict[str, Any]:
  """Get server capabilities."""
  deployments = await self.get_server_deployments()
  deployment_ids = [d['id'] for d in deployments]
  
  return await self._sdk.servers.capabilities.list({
   'server_deployment_id': deployment_ids
  })
 
 async def get_tool_manager(self) -> MetorialMcpToolManager:
  """Get tool manager for this session."""
  capabilities = await self.get_capabilities()
  return await MetorialMcpToolManager.from_capabilities(self, capabilities)
 
 async def get_client(self, deployment_id: str) -> MetorialMcpClient:
  """Get MCP client for a specific deployment."""
  if deployment_id not in self._client_promises:
   session = await self.get_session()
   
   self._client_promises[deployment_id] = asyncio.create_task(
    MetorialMcpClient.create(
     session=session,
     deployment_id=deployment_id,
     client_name=self.config.get('client', {}).get('name'),
     client_version=self.config.get('client', {}).get('version')
    )
   )
  
  return await self._client_promises[deployment_id]
 
 async def close(self):
  """Close the session and all clients."""
  clients = await asyncio.gather(
   *self._client_promises.values(),
   return_exceptions=True
  )
  
  close_tasks = []
  for client in clients:
   if isinstance(client, MetorialMcpClient):
    close_tasks.append(client.close())
  
  if close_tasks:
   await asyncio.gather(*close_tasks, return_exceptions=True)
 
 @property
 def mcp_host(self) -> str:
  """Get MCP host URL."""
  if hasattr(self._sdk, 'mcp_host') and self._sdk.mcp_host:
   return self._sdk.mcp_host
  
  api_host = self._sdk.api_host
  if api_host.startswith('https://api.metorial'):
   return api_host.replace('https://api.metorial', 'https://mcp.metorial')
  
  from urllib.parse import urlparse
  parsed = urlparse(api_host)
  return f"{parsed.scheme}://{parsed.hostname}:3311"
