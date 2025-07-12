
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServerRunsListOutput(data: Dict[str, Any]) -> ServerRunsListOutput:
  return ServerRunsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "type": item.get('type'),
      "status": item.get('status'),
      "server_version_id": item.get('server_version_id'),
      "server_deployment_id": item.get('server_deployment_id'),
      "server_session_id": item.get('server_session_id'),
      "session_id": item.get('session_id'),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
      "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at')),
      "started_at": item.get('started_at') and datetime.fromisoformat(item.get('started_at')),
      "stopped_at": item.get('stopped_at') and datetime.fromisoformat(item.get('stopped_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ServerRunsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServerRunsListQuery(data: Dict[str, Any]) -> ServerRunsListQuery:
  data

