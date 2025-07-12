
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersVariantsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServersVariantsListOutput(data: Dict[str, Any]) -> ServersVariantsListOutput:
  return ServersVariantsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "identifier": item.get('identifier'),
      "server_id": item.get('server_id'),
      "current_version": {
        "object": item.get('current_version', {}).get('object'),
        "id": item.get('current_version', {}).get('id'),
        "identifier": item.get('current_version', {}).get('identifier'),
        "server_id": item.get('current_version', {}).get('server_id'),
        "server_variant_id": item.get('current_version', {}).get('server_variant_id'),
        "get_launch_params": item.get('current_version', {}).get('get_launch_params'),
        "source": item.get('current_version', {}).get('source'),
        "schema": {
          "id": item.get('current_version', {}).get('schema', {}).get('id'),
          "fingerprint": item.get('current_version', {}).get('schema', {}).get('fingerprint'),
          "schema": item.get('current_version', {}).get('schema', {}).get('schema'),
          "server_id": item.get('current_version', {}).get('schema', {}).get('server_id'),
          "server_variant_id": item.get('current_version', {}).get('schema', {}).get('server_variant_id'),
          "server_version_id": item.get('current_version', {}).get('schema', {}).get('server_version_id'),
          "created_at": item.get('current_version', {}).get('schema', {}).get('created_at') and datetime.fromisoformat(item.get('current_version', {}).get('schema', {}).get('created_at'))
        },
        "created_at": item.get('current_version', {}).get('created_at') and datetime.fromisoformat(item.get('current_version', {}).get('created_at'))
      },
      "source": item.get('source'),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ServersVariantsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServersVariantsListQuery(data: Dict[str, Any]) -> ServersVariantsListQuery:
  data

