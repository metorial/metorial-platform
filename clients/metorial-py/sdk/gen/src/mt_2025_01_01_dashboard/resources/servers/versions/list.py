
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersVersionsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServersVersionsListOutput(data: Dict[str, Any]) -> ServersVersionsListOutput:
  return ServersVersionsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "identifier": item.get('identifier'),
      "server_id": item.get('server_id'),
      "server_variant_id": item.get('server_variant_id'),
      "get_launch_params": item.get('get_launch_params'),
      "source": item.get('source'),
      "schema": {
        "id": item.get('schema', {}).get('id'),
        "fingerprint": item.get('schema', {}).get('fingerprint'),
        "schema": item.get('schema', {}).get('schema'),
        "server_id": item.get('schema', {}).get('server_id'),
        "server_variant_id": item.get('schema', {}).get('server_variant_id'),
        "server_version_id": item.get('schema', {}).get('server_version_id'),
        "created_at": item.get('schema', {}).get('created_at') and datetime.fromisoformat(item.get('schema', {}).get('created_at'))
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
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ServersVersionsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServersVersionsListQuery(data: Dict[str, Any]) -> ServersVersionsListQuery:
  data

