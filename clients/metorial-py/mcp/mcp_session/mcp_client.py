"""MCP Client for communicating with Metorial servers."""

import aiohttp
from typing import Any, Dict
from urllib.parse import urljoin


class MetorialAPIError(Exception):
 """Exception raised for API errors."""
 
 def __init__(self, message: str, status_code: int = None):
  self.message = message
  self.status_code = status_code
  super().__init__(message)


class MetorialMcpClient:
 """MCP client for communicating with Metorial servers."""
 
 def __init__(self, session_id: str, deployment_id: str, client_secret: str, mcp_host: str):
  self.session_id = session_id
  self.deployment_id = deployment_id
  self.client_secret = client_secret
  self.mcp_host = mcp_host
  self.base_url = f"{mcp_host}/mcp/{session_id}/{deployment_id}"
 
 async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
  """Call a tool via MCP."""
  url = f"{self.base_url}/tools/{tool_name}"
  
  async with aiohttp.ClientSession() as session:
   async with session.post(
    url,
    json=arguments,
    params={'key': self.client_secret}
   ) as response:
    if response.status >= 400:
     error_text = await response.text()
     raise MetorialAPIError(f"Tool call failed: {error_text}", response.status)
    
    return await response.json()
 
 async def read_resource(self, uri: str) -> Dict[str, Any]:
  """Read a resource via MCP."""
  url = f"{self.base_url}/resources"
  
  async with aiohttp.ClientSession() as session:
   async with session.post(
    url,
    json={'uri': uri},
    params={'key': self.client_secret}
   ) as response:
    if response.status >= 400:
     error_text = await response.text()
     raise MetorialAPIError(f"Resource read failed: {error_text}", response.status)
    
    return await response.json()
 
 async def close(self):
  """Close the MCP client."""
  # close any persistent connections @RahmeKarim
  pass
 
 @classmethod
 async def create(cls, session: "MetorialSession", deployment_id: str, client_name: str = None, client_version: str = None):
  """Create a new MCP client instance."""
  return cls(
   session_id=session.id,
   deployment_id=deployment_id,
   client_secret=session.client_secret.secret,
   mcp_host=session._sdk.mcp_host
  )
