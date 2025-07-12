
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunErrorGroupsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServerRunErrorGroupsListOutput(data: Dict[str, Any]) -> ServerRunErrorGroupsListOutput:
  return ServerRunErrorGroupsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "code": item.get('code'),
      "message": item.get('message'),
      "fingerprint": item.get('fingerprint'),
      "default_error": {
        "object": item.get('default_error', {}).get('object'),
        "id": item.get('default_error', {}).get('id'),
        "code": item.get('default_error', {}).get('code'),
        "message": item.get('default_error', {}).get('message'),
        "metadata": item.get('default_error', {}).get('metadata'),
        "server_run": {
          "object": item.get('default_error', {}).get('server_run', {}).get('object'),
          "id": item.get('default_error', {}).get('server_run', {}).get('id'),
          "type": item.get('default_error', {}).get('server_run', {}).get('type'),
          "status": item.get('default_error', {}).get('server_run', {}).get('status'),
          "server_version_id": item.get('default_error', {}).get('server_run', {}).get('server_version_id'),
          "server_deployment_id": item.get('default_error', {}).get('server_run', {}).get('server_deployment_id'),
          "server_session_id": item.get('default_error', {}).get('server_run', {}).get('server_session_id'),
          "session_id": item.get('default_error', {}).get('server_run', {}).get('session_id'),
          "created_at": item.get('default_error', {}).get('server_run', {}).get('created_at') and datetime.fromisoformat(item.get('default_error', {}).get('server_run', {}).get('created_at')),
          "updated_at": item.get('default_error', {}).get('server_run', {}).get('updated_at') and datetime.fromisoformat(item.get('default_error', {}).get('server_run', {}).get('updated_at')),
          "started_at": item.get('default_error', {}).get('server_run', {}).get('started_at') and datetime.fromisoformat(item.get('default_error', {}).get('server_run', {}).get('started_at')),
          "stopped_at": item.get('default_error', {}).get('server_run', {}).get('stopped_at') and datetime.fromisoformat(item.get('default_error', {}).get('server_run', {}).get('stopped_at'))
        },
        "created_at": item.get('default_error', {}).get('created_at') and datetime.fromisoformat(item.get('default_error', {}).get('created_at'))
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

ServerRunErrorGroupsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServerRunErrorGroupsListQuery(data: Dict[str, Any]) -> ServerRunErrorGroupsListQuery:
  data

