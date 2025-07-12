
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
  server: Dict[str, Any]
  session: Dict[str, Any]
  server_deployment: Dict[str, Any]
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
  server={
    "object": data.get('server', {}).get('object'),
    "id": data.get('server', {}).get('id'),
    "name": data.get('server', {}).get('name'),
    "description": data.get('server', {}).get('description'),
    "type": data.get('server', {}).get('type'),
    "created_at": data.get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server', {}).get('created_at')),
    "updated_at": data.get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server', {}).get('updated_at'))
  },
  session={
    "object": data.get('session', {}).get('object'),
    "id": data.get('session', {}).get('id'),
    "status": data.get('session', {}).get('status'),
    "connection_status": data.get('session', {}).get('connection_status'),
    "usage": {
      "total_productive_message_count": data.get('session', {}).get('usage', {}).get('total_productive_message_count'),
      "total_productive_client_message_count": data.get('session', {}).get('usage', {}).get('total_productive_client_message_count'),
      "total_productive_server_message_count": data.get('session', {}).get('usage', {}).get('total_productive_server_message_count')
    },
    "metadata": data.get('session', {}).get('metadata'),
    "created_at": data.get('session', {}).get('created_at') and datetime.fromisoformat(data.get('session', {}).get('created_at')),
    "updated_at": data.get('session', {}).get('updated_at') and datetime.fromisoformat(data.get('session', {}).get('updated_at'))
  },
  server_deployment={
    "object": data.get('server_deployment', {}).get('object'),
    "id": data.get('server_deployment', {}).get('id'),
    "name": data.get('server_deployment', {}).get('name'),
    "description": data.get('server_deployment', {}).get('description'),
    "metadata": data.get('server_deployment', {}).get('metadata'),
    "created_at": data.get('server_deployment', {}).get('created_at') and datetime.fromisoformat(data.get('server_deployment', {}).get('created_at')),
    "updated_at": data.get('server_deployment', {}).get('updated_at') and datetime.fromisoformat(data.get('server_deployment', {}).get('updated_at')),
    "server": {
      "object": data.get('server_deployment', {}).get('server', {}).get('object'),
      "id": data.get('server_deployment', {}).get('server', {}).get('id'),
      "name": data.get('server_deployment', {}).get('server', {}).get('name'),
      "description": data.get('server_deployment', {}).get('server', {}).get('description'),
      "type": data.get('server_deployment', {}).get('server', {}).get('type'),
      "created_at": data.get('server_deployment', {}).get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server_deployment', {}).get('server', {}).get('created_at')),
      "updated_at": data.get('server_deployment', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server_deployment', {}).get('server', {}).get('updated_at'))
    }
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at'))
  )

