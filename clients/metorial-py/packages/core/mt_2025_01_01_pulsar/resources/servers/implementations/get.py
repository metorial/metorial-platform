
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersImplementationsGetOutput:
  object: str
  id: str
  status: str
  name: str
  metadata: Dict[str, Any]
  server_variant: Dict[str, Any]
  server: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  description: Optional[str] = None
  get_launch_params: Optional[str] = None


from typing import Any, Dict
from datetime import datetime

def mapServersImplementationsGetOutput(data: Dict[str, Any]) -> ServersImplementationsGetOutput:
  return ServersImplementationsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  name=data.get('name'),
  description=data.get('description'),
  metadata=data.get('metadata'),
  get_launch_params=data.get('get_launch_params'),
  server_variant={
    "id": data.get('server_variant', {}).get('id'),
    "identifier": data.get('server_variant', {}).get('identifier'),
    "source": data.get('server_variant', {}).get('source'),
    "created_at": data.get('server_variant', {}).get('created_at') and datetime.fromisoformat(data.get('server_variant', {}).get('created_at'))
  },
  server={
    "id": data.get('server', {}).get('id'),
    "name": data.get('server', {}).get('name'),
    "description": data.get('server', {}).get('description'),
    "type": data.get('server', {}).get('type'),
    "created_at": data.get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server', {}).get('created_at')),
    "updated_at": data.get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server', {}).get('updated_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

