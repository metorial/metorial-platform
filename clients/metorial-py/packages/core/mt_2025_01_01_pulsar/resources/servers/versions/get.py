
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersVersionsGetOutput:
  object: str
  id: str
  identifier: str
  server_id: str
  server_variant_id: str
  get_launch_params: str
  source: Union[Dict[str, Any], Dict[str, Any]]
  schema: Dict[str, Any]
  created_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapServersVersionsGetOutput(data: Dict[str, Any]) -> ServersVersionsGetOutput:
  return ServersVersionsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  identifier=data.get('identifier'),
  server_id=data.get('server_id'),
  server_variant_id=data.get('server_variant_id'),
  get_launch_params=data.get('get_launch_params'),
  source=data.get('source'),
  schema={
    "id": data.get('schema', {}).get('id'),
    "fingerprint": data.get('schema', {}).get('fingerprint'),
    "schema": data.get('schema', {}).get('schema'),
    "server_id": data.get('schema', {}).get('server_id'),
    "server_variant_id": data.get('schema', {}).get('server_variant_id'),
    "server_version_id": data.get('schema', {}).get('server_version_id'),
    "created_at": data.get('schema', {}).get('created_at') and datetime.fromisoformat(data.get('schema', {}).get('created_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at'))
  )

