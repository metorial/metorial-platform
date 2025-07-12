
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class SessionsServerSessionsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapSessionsServerSessionsListOutput(data: Dict[str, Any]) -> SessionsServerSessionsListOutput:
  return SessionsServerSessionsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "mcp": {
        "object": item.get('mcp', {}).get('object'),
        "version": item.get('mcp', {}).get('version'),
        "connection_type": item.get('mcp', {}).get('connection_type'),
        "client": {
          "object": item.get('mcp', {}).get('client', {}).get('object'),
          "name": item.get('mcp', {}).get('client', {}).get('name'),
          "version": item.get('mcp', {}).get('client', {}).get('version'),
          "capabilities": item.get('mcp', {}).get('client', {}).get('capabilities')
        },
        "server": {
          "object": item.get('mcp', {}).get('server', {}).get('object'),
          "name": item.get('mcp', {}).get('server', {}).get('name'),
          "version": item.get('mcp', {}).get('server', {}).get('version'),
          "capabilities": item.get('mcp', {}).get('server', {}).get('capabilities')
        }
      },
      "usage": {
        "total_productive_message_count": item.get('usage', {}).get('total_productive_message_count'),
        "total_productive_client_message_count": item.get('usage', {}).get('total_productive_client_message_count'),
        "total_productive_server_message_count": item.get('usage', {}).get('total_productive_server_message_count')
      },
      "server": {
        "object": item.get('server', {}).get('object'),
        "id": item.get('server', {}).get('id'),
        "name": item.get('server', {}).get('name'),
        "description": item.get('server', {}).get('description'),
        "type": item.get('server', {}).get('type'),
        "created_at": item.get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server', {}).get('created_at')),
        "updated_at": item.get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server', {}).get('updated_at'))
      },
      "session": {
        "object": item.get('session', {}).get('object'),
        "id": item.get('session', {}).get('id'),
        "status": item.get('session', {}).get('status'),
        "connection_status": item.get('session', {}).get('connection_status'),
        "usage": {
          "total_productive_message_count": item.get('session', {}).get('usage', {}).get('total_productive_message_count'),
          "total_productive_client_message_count": item.get('session', {}).get('usage', {}).get('total_productive_client_message_count'),
          "total_productive_server_message_count": item.get('session', {}).get('usage', {}).get('total_productive_server_message_count')
        },
        "metadata": item.get('session', {}).get('metadata'),
        "created_at": item.get('session', {}).get('created_at') and datetime.fromisoformat(item.get('session', {}).get('created_at')),
        "updated_at": item.get('session', {}).get('updated_at') and datetime.fromisoformat(item.get('session', {}).get('updated_at'))
      },
      "server_deployment": {
        "object": item.get('server_deployment', {}).get('object'),
        "id": item.get('server_deployment', {}).get('id'),
        "name": item.get('server_deployment', {}).get('name'),
        "description": item.get('server_deployment', {}).get('description'),
        "metadata": item.get('server_deployment', {}).get('metadata'),
        "created_at": item.get('server_deployment', {}).get('created_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('created_at')),
        "updated_at": item.get('server_deployment', {}).get('updated_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('updated_at')),
        "server": {
          "object": item.get('server_deployment', {}).get('server', {}).get('object'),
          "id": item.get('server_deployment', {}).get('server', {}).get('id'),
          "name": item.get('server_deployment', {}).get('server', {}).get('name'),
          "description": item.get('server_deployment', {}).get('server', {}).get('description'),
          "type": item.get('server_deployment', {}).get('server', {}).get('type'),
          "created_at": item.get('server_deployment', {}).get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('server', {}).get('created_at')),
          "updated_at": item.get('server_deployment', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('server', {}).get('updated_at'))
        }
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

SessionsServerSessionsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapSessionsServerSessionsListQuery(data: Dict[str, Any]) -> SessionsServerSessionsListQuery:
  data

