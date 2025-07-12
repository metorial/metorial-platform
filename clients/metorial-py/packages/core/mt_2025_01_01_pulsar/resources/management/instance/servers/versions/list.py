
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementInstanceServersVersionsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapManagementInstanceServersVersionsListOutput(data: Dict[str, Any]) -> ManagementInstanceServersVersionsListOutput:
  return ManagementInstanceServersVersionsListOutput(
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
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ManagementInstanceServersVersionsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapManagementInstanceServersVersionsListQuery(data: Dict[str, Any]) -> ManagementInstanceServersVersionsListQuery:
  data

