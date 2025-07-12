
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServerRunsGetOutput:
  object: str
  id: str
  type: str
  status: str
  server_version_id: str
  server_deployment_id: str
  server_session_id: str
  session_id: str
  created_at: datetime
  updated_at: datetime
  started_at: Optional[datetime] = None
  stopped_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapServerRunsGetOutput(data: Dict[str, Any]) -> ServerRunsGetOutput:
  return ServerRunsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  type=data.get('type'),
  status=data.get('status'),
  server_version_id=data.get('server_version_id'),
  server_deployment_id=data.get('server_deployment_id'),
  server_session_id=data.get('server_session_id'),
  session_id=data.get('session_id'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at')),
  started_at=data.get('started_at') and datetime.fromisoformat(data.get('started_at')),
  stopped_at=data.get('stopped_at') and datetime.fromisoformat(data.get('stopped_at'))
  )

