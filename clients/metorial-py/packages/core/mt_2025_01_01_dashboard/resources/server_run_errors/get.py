
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunErrorsGetOutput:
  object: str
  id: str
  code: str
  message: str
  metadata: Dict[str, Any]
  server_run: Dict[str, Any]
  created_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapServerRunErrorsGetOutput(data: Dict[str, Any]) -> ServerRunErrorsGetOutput:
  return ServerRunErrorsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  code=data.get('code'),
  message=data.get('message'),
  metadata=data.get('metadata'),
  server_run={
    "object": data.get('server_run', {}).get('object'),
    "id": data.get('server_run', {}).get('id'),
    "type": data.get('server_run', {}).get('type'),
    "status": data.get('server_run', {}).get('status'),
    "server_version_id": data.get('server_run', {}).get('server_version_id'),
    "server_deployment_id": data.get('server_run', {}).get('server_deployment_id'),
    "server_session_id": data.get('server_run', {}).get('server_session_id'),
    "session_id": data.get('server_run', {}).get('session_id'),
    "created_at": data.get('server_run', {}).get('created_at') and datetime.fromisoformat(data.get('server_run', {}).get('created_at')),
    "updated_at": data.get('server_run', {}).get('updated_at') and datetime.fromisoformat(data.get('server_run', {}).get('updated_at')),
    "started_at": data.get('server_run', {}).get('started_at') and datetime.fromisoformat(data.get('server_run', {}).get('started_at')),
    "stopped_at": data.get('server_run', {}).get('stopped_at') and datetime.fromisoformat(data.get('server_run', {}).get('stopped_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at'))
  )

