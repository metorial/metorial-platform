
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunErrorGroupsGetOutput:
  object: str
  id: str
  code: str
  message: str
  fingerprint: str
  created_at: datetime
  default_error: Optional[Dict[str, Any]] = None


from typing import Any, Dict
from datetime import datetime

def mapServerRunErrorGroupsGetOutput(data: Dict[str, Any]) -> ServerRunErrorGroupsGetOutput:
  return ServerRunErrorGroupsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  code=data.get('code'),
  message=data.get('message'),
  fingerprint=data.get('fingerprint'),
  default_error={
    "object": data.get('default_error', {}).get('object'),
    "id": data.get('default_error', {}).get('id'),
    "code": data.get('default_error', {}).get('code'),
    "message": data.get('default_error', {}).get('message'),
    "metadata": data.get('default_error', {}).get('metadata'),
    "server_run": {
      "object": data.get('default_error', {}).get('server_run', {}).get('object'),
      "id": data.get('default_error', {}).get('server_run', {}).get('id'),
      "type": data.get('default_error', {}).get('server_run', {}).get('type'),
      "status": data.get('default_error', {}).get('server_run', {}).get('status'),
      "server_version_id": data.get('default_error', {}).get('server_run', {}).get('server_version_id'),
      "server_deployment_id": data.get('default_error', {}).get('server_run', {}).get('server_deployment_id'),
      "server_session_id": data.get('default_error', {}).get('server_run', {}).get('server_session_id'),
      "session_id": data.get('default_error', {}).get('server_run', {}).get('session_id'),
      "created_at": data.get('default_error', {}).get('server_run', {}).get('created_at') and datetime.fromisoformat(data.get('default_error', {}).get('server_run', {}).get('created_at')),
      "updated_at": data.get('default_error', {}).get('server_run', {}).get('updated_at') and datetime.fromisoformat(data.get('default_error', {}).get('server_run', {}).get('updated_at')),
      "started_at": data.get('default_error', {}).get('server_run', {}).get('started_at') and datetime.fromisoformat(data.get('default_error', {}).get('server_run', {}).get('started_at')),
      "stopped_at": data.get('default_error', {}).get('server_run', {}).get('stopped_at') and datetime.fromisoformat(data.get('default_error', {}).get('server_run', {}).get('stopped_at'))
    },
    "created_at": data.get('default_error', {}).get('created_at') and datetime.fromisoformat(data.get('default_error', {}).get('created_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at'))
  )

