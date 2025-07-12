
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersGetOutput:
  object: str
  id: str
  type: str
  name: str
  variants: List[Dict[str, Any]]
  metadata: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  description: Optional[str] = None
  imported_server_id: Optional[str] = None


from typing import Any, Dict
from datetime import datetime

def mapServersGetOutput(data: Dict[str, Any]) -> ServersGetOutput:
  return ServersGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  type=data.get('type'),
  name=data.get('name'),
  description=data.get('description'),
  imported_server_id=data.get('imported_server_id'),
  variants=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "identifier": item.get('identifier'),
      "server": {
        "object": item.get('server', {}).get('object'),
        "id": item.get('server', {}).get('id'),
        "name": item.get('server', {}).get('name'),
        "description": item.get('server', {}).get('description'),
        "type": item.get('server', {}).get('type'),
        "created_at": item.get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server', {}).get('created_at')),
        "updated_at": item.get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server', {}).get('updated_at'))
      },
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
        "server": {
          "object": item.get('current_version', {}).get('server', {}).get('object'),
          "id": item.get('current_version', {}).get('server', {}).get('id'),
          "name": item.get('current_version', {}).get('server', {}).get('name'),
          "description": item.get('current_version', {}).get('server', {}).get('description'),
          "type": item.get('current_version', {}).get('server', {}).get('type'),
          "created_at": item.get('current_version', {}).get('server', {}).get('created_at') and datetime.fromisoformat(item.get('current_version', {}).get('server', {}).get('created_at')),
          "updated_at": item.get('current_version', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('current_version', {}).get('server', {}).get('updated_at'))
        },
        "created_at": item.get('current_version', {}).get('created_at') and datetime.fromisoformat(item.get('current_version', {}).get('created_at'))
      },
      "source": item.get('source'),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at'))
    } for item in data.get('variants', [])],
  metadata=data.get('metadata'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

