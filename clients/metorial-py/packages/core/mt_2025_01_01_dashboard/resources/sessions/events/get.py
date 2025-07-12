
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class SessionsEventsGetOutput:
  object: str
  id: str
  type: str
  session_id: str
  created_at: datetime
  server_run: Optional[Dict[str, Any]] = None


from typing import Any, Dict
from datetime import datetime

def mapSessionsEventsGetOutput(data: Dict[str, Any]) -> SessionsEventsGetOutput:
  return SessionsEventsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  type=data.get('type'),
  session_id=data.get('session_id'),
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

