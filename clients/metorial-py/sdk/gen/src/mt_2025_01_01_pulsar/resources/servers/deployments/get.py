
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersDeploymentsGetOutput:
  object: str
  id: str
  status: str
  name: str
  metadata: Dict[str, Any]
  secret_id: str
  server: Dict[str, Any]
  config: Dict[str, Any]
  server_implementation: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  description: Optional[str] = None


from typing import Any, Dict
from datetime import datetime

def mapServersDeploymentsGetOutput(data: Dict[str, Any]) -> ServersDeploymentsGetOutput:
  return ServersDeploymentsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  name=data.get('name'),
  description=data.get('description'),
  metadata=data.get('metadata'),
  secret_id=data.get('secret_id'),
  server={
    "object": data.get('server', {}).get('object'),
    "id": data.get('server', {}).get('id'),
    "name": data.get('server', {}).get('name'),
    "description": data.get('server', {}).get('description'),
    "type": data.get('server', {}).get('type'),
    "created_at": data.get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server', {}).get('created_at')),
    "updated_at": data.get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server', {}).get('updated_at'))
  },
  config={
    "object": data.get('config', {}).get('object'),
    "id": data.get('config', {}).get('id'),
    "status": data.get('config', {}).get('status'),
    "secret_id": data.get('config', {}).get('secret_id'),
    "created_at": data.get('config', {}).get('created_at') and datetime.fromisoformat(data.get('config', {}).get('created_at'))
  },
  server_implementation={
    "object": data.get('server_implementation', {}).get('object'),
    "id": data.get('server_implementation', {}).get('id'),
    "status": data.get('server_implementation', {}).get('status'),
    "name": data.get('server_implementation', {}).get('name'),
    "description": data.get('server_implementation', {}).get('description'),
    "metadata": data.get('server_implementation', {}).get('metadata'),
    "get_launch_params": data.get('server_implementation', {}).get('get_launch_params'),
    "server_variant": {
      "object": data.get('server_implementation', {}).get('server_variant', {}).get('object'),
      "id": data.get('server_implementation', {}).get('server_variant', {}).get('id'),
      "identifier": data.get('server_implementation', {}).get('server_variant', {}).get('identifier'),
      "server_id": data.get('server_implementation', {}).get('server_variant', {}).get('server_id'),
      "source": data.get('server_implementation', {}).get('server_variant', {}).get('source'),
      "created_at": data.get('server_implementation', {}).get('server_variant', {}).get('created_at') and datetime.fromisoformat(data.get('server_implementation', {}).get('server_variant', {}).get('created_at'))
    },
    "server": {
      "object": data.get('server_implementation', {}).get('server', {}).get('object'),
      "id": data.get('server_implementation', {}).get('server', {}).get('id'),
      "name": data.get('server_implementation', {}).get('server', {}).get('name'),
      "description": data.get('server_implementation', {}).get('server', {}).get('description'),
      "type": data.get('server_implementation', {}).get('server', {}).get('type'),
      "created_at": data.get('server_implementation', {}).get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server_implementation', {}).get('server', {}).get('created_at')),
      "updated_at": data.get('server_implementation', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server_implementation', {}).get('server', {}).get('updated_at'))
    },
    "created_at": data.get('server_implementation', {}).get('created_at') and datetime.fromisoformat(data.get('server_implementation', {}).get('created_at')),
    "updated_at": data.get('server_implementation', {}).get('updated_at') and datetime.fromisoformat(data.get('server_implementation', {}).get('updated_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

