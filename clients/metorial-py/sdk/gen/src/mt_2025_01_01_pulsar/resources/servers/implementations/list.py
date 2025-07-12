
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersImplementationsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServersImplementationsListOutput(data: Dict[str, Any]) -> ServersImplementationsListOutput:
  return ServersImplementationsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "name": item.get('name'),
      "description": item.get('description'),
      "metadata": item.get('metadata'),
      "get_launch_params": item.get('get_launch_params'),
      "server_variant": {
        "object": item.get('server_variant', {}).get('object'),
        "id": item.get('server_variant', {}).get('id'),
        "identifier": item.get('server_variant', {}).get('identifier'),
        "server_id": item.get('server_variant', {}).get('server_id'),
        "source": item.get('server_variant', {}).get('source'),
        "created_at": item.get('server_variant', {}).get('created_at') and datetime.fromisoformat(item.get('server_variant', {}).get('created_at'))
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

ServersImplementationsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServersImplementationsListQuery(data: Dict[str, Any]) -> ServersImplementationsListQuery:
  data

