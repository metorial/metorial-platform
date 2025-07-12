
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class SessionsMessagesGetOutput:
  object: str
  id: str
  type: str
  sender: Dict[str, Any]
  mcp_message: Dict[str, Any]
  session_id: str
  server_session_id: str
  created_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapSessionsMessagesGetOutput(data: Dict[str, Any]) -> SessionsMessagesGetOutput:
  return SessionsMessagesGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  type=data.get('type'),
  sender={
    "object": data.get('sender', {}).get('object'),
    "type": data.get('sender', {}).get('type'),
    "id": data.get('sender', {}).get('id')
  },
  mcp_message={
    "object": data.get('mcp_message', {}).get('object'),
    "id": data.get('mcp_message', {}).get('id'),
    "method": data.get('mcp_message', {}).get('method'),
    "payload": data.get('mcp_message', {}).get('payload')
  },
  session_id=data.get('session_id'),
  server_session_id=data.get('server_session_id'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at'))
  )

