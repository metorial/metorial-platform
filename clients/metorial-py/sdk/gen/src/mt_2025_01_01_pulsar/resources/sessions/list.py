
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class SessionsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapSessionsListOutput(data: Dict[str, Any]) -> SessionsListOutput:
  return SessionsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "connection_status": item.get('connection_status'),
      "client_secret": {
        "object": item.get('client_secret', {}).get('object'),
        "type": item.get('client_secret', {}).get('type'),
        "id": item.get('client_secret', {}).get('id'),
        "secret": item.get('client_secret', {}).get('secret'),
        "expires_at": item.get('client_secret', {}).get('expires_at') and datetime.fromisoformat(item.get('client_secret', {}).get('expires_at'))
      },
      "server_deployments": [{
          "object": item.get('object'),
          "id": item.get('id'),
          "name": item.get('name'),
          "description": item.get('description'),
          "metadata": item.get('metadata'),
          "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
          "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at')),
          "server": {
            "object": item.get('server', {}).get('object'),
            "id": item.get('server', {}).get('id'),
            "name": item.get('server', {}).get('name'),
            "description": item.get('server', {}).get('description'),
            "type": item.get('server', {}).get('type'),
            "created_at": item.get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server', {}).get('created_at')),
            "updated_at": item.get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server', {}).get('updated_at'))
          }
        } for item in item.get('server_deployments', [])],
      "usage": {
        "total_productive_message_count": item.get('usage', {}).get('total_productive_message_count'),
        "total_productive_client_message_count": item.get('usage', {}).get('total_productive_client_message_count'),
        "total_productive_server_message_count": item.get('usage', {}).get('total_productive_server_message_count')
      },
      "metadata": item.get('metadata'),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
      "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

SessionsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapSessionsListQuery(data: Dict[str, Any]) -> SessionsListQuery:
  data

