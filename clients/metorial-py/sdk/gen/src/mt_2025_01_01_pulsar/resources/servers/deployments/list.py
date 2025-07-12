
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersDeploymentsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServersDeploymentsListOutput(data: Dict[str, Any]) -> ServersDeploymentsListOutput:
  return ServersDeploymentsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "name": item.get('name'),
      "description": item.get('description'),
      "metadata": item.get('metadata'),
      "secret_id": item.get('secret_id'),
      "server": {
        "object": item.get('server', {}).get('object'),
        "id": item.get('server', {}).get('id'),
        "name": item.get('server', {}).get('name'),
        "description": item.get('server', {}).get('description'),
        "type": item.get('server', {}).get('type'),
        "created_at": item.get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server', {}).get('created_at')),
        "updated_at": item.get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server', {}).get('updated_at'))
      },
      "config": {
        "object": item.get('config', {}).get('object'),
        "id": item.get('config', {}).get('id'),
        "status": item.get('config', {}).get('status'),
        "secret_id": item.get('config', {}).get('secret_id'),
        "created_at": item.get('config', {}).get('created_at') and datetime.fromisoformat(item.get('config', {}).get('created_at'))
      },
      "server_implementation": {
        "object": item.get('server_implementation', {}).get('object'),
        "id": item.get('server_implementation', {}).get('id'),
        "status": item.get('server_implementation', {}).get('status'),
        "name": item.get('server_implementation', {}).get('name'),
        "description": item.get('server_implementation', {}).get('description'),
        "metadata": item.get('server_implementation', {}).get('metadata'),
        "get_launch_params": item.get('server_implementation', {}).get('get_launch_params'),
        "server_variant": {
          "object": item.get('server_implementation', {}).get('server_variant', {}).get('object'),
          "id": item.get('server_implementation', {}).get('server_variant', {}).get('id'),
          "identifier": item.get('server_implementation', {}).get('server_variant', {}).get('identifier'),
          "server_id": item.get('server_implementation', {}).get('server_variant', {}).get('server_id'),
          "source": item.get('server_implementation', {}).get('server_variant', {}).get('source'),
          "created_at": item.get('server_implementation', {}).get('server_variant', {}).get('created_at') and datetime.fromisoformat(item.get('server_implementation', {}).get('server_variant', {}).get('created_at'))
        },
        "server": {
          "object": item.get('server_implementation', {}).get('server', {}).get('object'),
          "id": item.get('server_implementation', {}).get('server', {}).get('id'),
          "name": item.get('server_implementation', {}).get('server', {}).get('name'),
          "description": item.get('server_implementation', {}).get('server', {}).get('description'),
          "type": item.get('server_implementation', {}).get('server', {}).get('type'),
          "created_at": item.get('server_implementation', {}).get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server_implementation', {}).get('server', {}).get('created_at')),
          "updated_at": item.get('server_implementation', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server_implementation', {}).get('server', {}).get('updated_at'))
        },
        "created_at": item.get('server_implementation', {}).get('created_at') and datetime.fromisoformat(item.get('server_implementation', {}).get('created_at')),
        "updated_at": item.get('server_implementation', {}).get('updated_at') and datetime.fromisoformat(item.get('server_implementation', {}).get('updated_at'))
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

ServersDeploymentsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServersDeploymentsListQuery(data: Dict[str, Any]) -> ServersDeploymentsListQuery:
  data

