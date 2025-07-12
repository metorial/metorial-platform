
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class SessionsServerSessionsGetOutput:
  object: str
  id: str
  status: str
  mcp: Dict[str, Any]
  usage: Dict[str, Any]
  server_deployment_id: str
  session_id: str
  created_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapSessionsServerSessionsGetOutput(data: Dict[str, Any]) -> SessionsServerSessionsGetOutput:
  return SessionsServerSessionsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  mcp={
    "object": data.get('mcp', {}).get('object'),
    "version": data.get('mcp', {}).get('version'),
    "connection_type": data.get('mcp', {}).get('connection_type'),
    "client": {
      "object": data.get('mcp', {}).get('client', {}).get('object'),
      "name": data.get('mcp', {}).get('client', {}).get('name'),
      "version": data.get('mcp', {}).get('client', {}).get('version'),
      "capabilities": data.get('mcp', {}).get('client', {}).get('capabilities')
    },
    "server": {
      "object": data.get('mcp', {}).get('server', {}).get('object'),
      "name": data.get('mcp', {}).get('server', {}).get('name'),
      "version": data.get('mcp', {}).get('server', {}).get('version'),
      "capabilities": data.get('mcp', {}).get('server', {}).get('capabilities')
    }
  },
  usage={
    "total_productive_message_count": data.get('usage', {}).get('total_productive_message_count'),
    "total_productive_client_message_count": data.get('usage', {}).get('total_productive_client_message_count'),
    "total_productive_server_message_count": data.get('usage', {}).get('total_productive_server_message_count')
  },
  server_deployment_id=data.get('server_deployment_id'),
  session_id=data.get('session_id'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at'))
  )

