
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class SecretsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapSecretsListOutput(data: Dict[str, Any]) -> SecretsListOutput:
  return SecretsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "type": {
        "identifier": item.get('type', {}).get('identifier'),
        "name": item.get('type', {}).get('name')
      },
      "description": item.get('description'),
      "metadata": item.get('metadata'),
      "organization_id": item.get('organization_id'),
      "instance_id": item.get('instance_id'),
      "fingerprint": item.get('fingerprint'),
      "last_used_at": item.get('last_used_at') and datetime.fromisoformat(item.get('last_used_at')),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

SecretsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapSecretsListQuery(data: Dict[str, Any]) -> SecretsListQuery:
  data

