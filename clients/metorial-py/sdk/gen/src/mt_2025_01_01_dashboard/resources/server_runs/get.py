
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunsGetOutput:
  object: str
  id: str
  type: str
  status: str
  server_version_id: str
  server: Dict[str, Any]
  server_deployment: Dict[str, Any]
  server_session: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  started_at: Optional[datetime] = None
  stopped_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapServerRunsGetOutput(data: Dict[str, Any]) -> ServerRunsGetOutput:
  return ServerRunsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  type=data.get('type'),
  status=data.get('status'),
  server_version_id=data.get('server_version_id'),
  server={
    "object": data.get('server', {}).get('object'),
    "id": data.get('server', {}).get('id'),
    "name": data.get('server', {}).get('name'),
    "description": data.get('server', {}).get('description'),
    "type": data.get('server', {}).get('type'),
    "created_at": data.get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server', {}).get('created_at')),
    "updated_at": data.get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server', {}).get('updated_at'))
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
  server_session={
    "object": data.get('server_session', {}).get('object'),
    "id": data.get('server_session', {}).get('id'),
    "status": data.get('server_session', {}).get('status'),
    "mcp": {
      "object": data.get('server_session', {}).get('mcp', {}).get('object'),
      "version": data.get('server_session', {}).get('mcp', {}).get('version'),
      "connection_type": data.get('server_session', {}).get('mcp', {}).get('connection_type'),
      "client": {
        "object": data.get('server_session', {}).get('mcp', {}).get('client', {}).get('object'),
        "name": data.get('server_session', {}).get('mcp', {}).get('client', {}).get('name'),
        "version": data.get('server_session', {}).get('mcp', {}).get('client', {}).get('version'),
        "capabilities": data.get('server_session', {}).get('mcp', {}).get('client', {}).get('capabilities')
      },
      "server": {
        "object": data.get('server_session', {}).get('mcp', {}).get('server', {}).get('object'),
        "name": data.get('server_session', {}).get('mcp', {}).get('server', {}).get('name'),
        "version": data.get('server_session', {}).get('mcp', {}).get('server', {}).get('version'),
        "capabilities": data.get('server_session', {}).get('mcp', {}).get('server', {}).get('capabilities')
      }
    },
    "usage": {
      "total_productive_message_count": data.get('server_session', {}).get('usage', {}).get('total_productive_message_count'),
      "total_productive_client_message_count": data.get('server_session', {}).get('usage', {}).get('total_productive_client_message_count'),
      "total_productive_server_message_count": data.get('server_session', {}).get('usage', {}).get('total_productive_server_message_count')
    },
    "session_id": data.get('server_session', {}).get('session_id'),
    "created_at": data.get('server_session', {}).get('created_at') and datetime.fromisoformat(data.get('server_session', {}).get('created_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at')),
  started_at=data.get('started_at') and datetime.fromisoformat(data.get('started_at')),
  stopped_at=data.get('stopped_at') and datetime.fromisoformat(data.get('stopped_at'))
  )

