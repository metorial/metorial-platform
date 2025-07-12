
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunErrorsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServerRunErrorsListOutput(data: Dict[str, Any]) -> ServerRunErrorsListOutput:
  return ServerRunErrorsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "code": item.get('code'),
      "message": item.get('message'),
      "metadata": item.get('metadata'),
      "server_run": {
        "object": item.get('server_run', {}).get('object'),
        "id": item.get('server_run', {}).get('id'),
        "type": item.get('server_run', {}).get('type'),
        "status": item.get('server_run', {}).get('status'),
        "server_version_id": item.get('server_run', {}).get('server_version_id'),
        "server": {
          "object": item.get('server_run', {}).get('server', {}).get('object'),
          "id": item.get('server_run', {}).get('server', {}).get('id'),
          "name": item.get('server_run', {}).get('server', {}).get('name'),
          "description": item.get('server_run', {}).get('server', {}).get('description'),
          "type": item.get('server_run', {}).get('server', {}).get('type'),
          "created_at": item.get('server_run', {}).get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server_run', {}).get('server', {}).get('created_at')),
          "updated_at": item.get('server_run', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server_run', {}).get('server', {}).get('updated_at'))
        },
        "server_deployment": {
          "object": item.get('server_run', {}).get('server_deployment', {}).get('object'),
          "id": item.get('server_run', {}).get('server_deployment', {}).get('id'),
          "name": item.get('server_run', {}).get('server_deployment', {}).get('name'),
          "description": item.get('server_run', {}).get('server_deployment', {}).get('description'),
          "metadata": item.get('server_run', {}).get('server_deployment', {}).get('metadata'),
          "created_at": item.get('server_run', {}).get('server_deployment', {}).get('created_at') and datetime.fromisoformat(item.get('server_run', {}).get('server_deployment', {}).get('created_at')),
          "updated_at": item.get('server_run', {}).get('server_deployment', {}).get('updated_at') and datetime.fromisoformat(item.get('server_run', {}).get('server_deployment', {}).get('updated_at')),
          "server": {
            "object": item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('object'),
            "id": item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('id'),
            "name": item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('name'),
            "description": item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('description'),
            "type": item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('type'),
            "created_at": item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('created_at')),
            "updated_at": item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server_run', {}).get('server_deployment', {}).get('server', {}).get('updated_at'))
          }
        },
        "server_session": {
          "object": item.get('server_run', {}).get('server_session', {}).get('object'),
          "id": item.get('server_run', {}).get('server_session', {}).get('id'),
          "status": item.get('server_run', {}).get('server_session', {}).get('status'),
          "mcp": {
            "object": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('object'),
            "version": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('version'),
            "connection_type": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('connection_type'),
            "client": {
              "object": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('object'),
              "name": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('name'),
              "version": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('version'),
              "capabilities": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('client', {}).get('capabilities')
            },
            "server": {
              "object": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('object'),
              "name": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('name'),
              "version": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('version'),
              "capabilities": item.get('server_run', {}).get('server_session', {}).get('mcp', {}).get('server', {}).get('capabilities')
            }
          },
          "usage": {
            "total_productive_message_count": item.get('server_run', {}).get('server_session', {}).get('usage', {}).get('total_productive_message_count'),
            "total_productive_client_message_count": item.get('server_run', {}).get('server_session', {}).get('usage', {}).get('total_productive_client_message_count'),
            "total_productive_server_message_count": item.get('server_run', {}).get('server_session', {}).get('usage', {}).get('total_productive_server_message_count')
          },
          "session_id": item.get('server_run', {}).get('server_session', {}).get('session_id'),
          "created_at": item.get('server_run', {}).get('server_session', {}).get('created_at') and datetime.fromisoformat(item.get('server_run', {}).get('server_session', {}).get('created_at'))
        },
        "created_at": item.get('server_run', {}).get('created_at') and datetime.fromisoformat(item.get('server_run', {}).get('created_at')),
        "updated_at": item.get('server_run', {}).get('updated_at') and datetime.fromisoformat(item.get('server_run', {}).get('updated_at')),
        "started_at": item.get('server_run', {}).get('started_at') and datetime.fromisoformat(item.get('server_run', {}).get('started_at')),
        "stopped_at": item.get('server_run', {}).get('stopped_at') and datetime.fromisoformat(item.get('server_run', {}).get('stopped_at'))
      },
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ServerRunErrorsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServerRunErrorsListQuery(data: Dict[str, Any]) -> ServerRunErrorsListQuery:
  data

