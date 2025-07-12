
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunErrorsGetOutput:
  object: str
  id: str
  code: str
  message: str
  metadata: Dict[str, Any]
  server_run: Dict[str, Any]
  created_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapServerRunErrorsGetOutput(data: Dict[str, Any]) -> ServerRunErrorsGetOutput:
  return ServerRunErrorsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  code=data.get('code'),
  message=data.get('message'),
  metadata=data.get('metadata'),
  server_run={
    "object": data.get('server_run', {}).get('object'),
    "id": data.get('server_run', {}).get('id'),
    "type": data.get('server_run', {}).get('type'),
    "status": data.get('server_run', {}).get('status'),
    "server_version_id": data.get('server_run', {}).get('server_version_id'),
    "server": {
      "object": data.get('server_run', {}).get('server', {}).get('object'),
      "id": data.get('server_run', {}).get('server', {}).get('id'),
      "name": data.get('server_run', {}).get('server', {}).get('name'),
      "description": data.get('server_run', {}).get('server', {}).get('description'),
      "type": data.get('server_run', {}).get('server', {}).get('type'),
      "created_at": data.get('server_run', {}).get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server_run', {}).get('server', {}).get('created_at')),
      "updated_at": data.get('server_run', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server_run', {}).get('server', {}).get('updated_at'))
    },
    "server_deployment": {
      "object": data.get('server_run', {}).get('server_deployment', {}).get('object'),
      "id": data.get('server_run', {}).get('server_deployment', {}).get('id'),
      "name": data.get('server_run', {}).get('server_deployment', {}).get('name'),
      "description": data.get('server_run', {}).get('server_deployment', {}).get('description'),
      "metadata": data.get('server_run', {}).get('server_deployment', {}).get('metadata'),
      "created_at": data.get('server_run', {}).get('server_deployment', {}).get('created_at') and datetime.fromisoformat(data.get('server_run', {}).get('server_deployment', {}).get('created_at')),
      "updated_at": data.get('server_run', {}).get('server_deployment', {}).get('updated_at') and datetime.fromisoformat(data.get('server_run', {}).get('server_deployment', {}).get('updated_at')),
      "server": {
        "object": data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('object'),
        "id": data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('id'),
        "name": data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('name'),
        "description": data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('description'),
        "type": data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('type'),
        "created_at": data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('created_at')),
        "updated_at": data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('updated_at'))
      }
    },
    "server_session": {
      "object": data.get('server_run', {}).get('server_session', {}).get('object'),
      "id": data.get('server_run', {}).get('server_session', {}).get('id'),
      "status": data.get('server_run', {}).get('server_session', {}).get('status'),
      "mcp": {
        "object": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('object'),
        "version": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('version'),
        "connection_type": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('connection_type'),
        "client": {
          "object": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('object'),
          "name": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('name'),
          "version": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('version'),
          "capabilities": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('capabilities')
        },
        "server": {
          "object": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('object'),
          "name": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('name'),
          "version": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('version'),
          "capabilities": data.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('capabilities')
        }
      },
      "usage": {
        "total_productive_message_count": data.get('server_run', {}).get('server_session', {}).get('usage', {}).get('total_productive_message_count'),
        "total_productive_client_message_count": data.get('server_run', {}).get('server_session', {}).get('usage', {}).get('total_productive_client_message_count'),
        "total_productive_server_message_count": data.get('server_run', {}).get('server_session', {}).get('usage', {}).get('total_productive_server_message_count')
      },
      "session_id": data.get('server_run', {}).get('server_session', {}).get('session_id'),
      "created_at": data.get('server_run', {}).get('server_session', {}).get('created_at') and datetime.fromisoformat(data.get('server_run', {}).get('server_session', {}).get('created_at'))
    },
    "created_at": data.get('server_run', {}).get('created_at') and datetime.fromisoformat(data.get('server_run', {}).get('created_at')),
    "updated_at": data.get('server_run', {}).get('updated_at') and datetime.fromisoformat(data.get('server_run', {}).get('updated_at')),
    "started_at": data.get('server_run', {}).get('started_at') and datetime.fromisoformat(data.get('server_run', {}).get('started_at')),
    "stopped_at": data.get('server_run', {}).get('stopped_at') and datetime.fromisoformat(data.get('server_run', {}).get('stopped_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at'))
  )

