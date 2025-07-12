
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersImplementationsCreateOutput:
  object: str
  id: str
  status: str
  is_default: bool
  is_ephemeral: bool
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

def mapServersImplementationsCreateOutput(data: Dict[str, Any]) -> ServersImplementationsCreateOutput:
  return ServersImplementationsCreateOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  is_default=data.get('is_default'),
  is_ephemeral=data.get('is_ephemeral'),
  name=data.get('name'),
  description=data.get('description'),
  metadata=data.get('metadata'),
  get_launch_params=data.get('get_launch_params'),
  server_variant={
    "object": data.get('server_variant', {}).get('object'),
    "id": data.get('server_variant', {}).get('id'),
    "identifier": data.get('server_variant', {}).get('identifier'),
    "server_id": data.get('server_variant', {}).get('server_id'),
    "source": data.get('server_variant', {}).get('source'),
    "created_at": data.get('server_variant', {}).get('created_at') and datetime.fromisoformat(data.get('server_variant', {}).get('created_at'))
  },
  server={
    "object": data.get('server', {}).get('object'),
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


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ServersImplementationsCreateBody = Any


from typing import Any, Dict
from datetime import datetime

def mapServersImplementationsCreateBody(data: Dict[str, Any]) -> ServersImplementationsCreateBody:
  data

