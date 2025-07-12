
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardInstanceSessionsMessagesListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapDashboardInstanceSessionsMessagesListOutput(data: Dict[str, Any]) -> DashboardInstanceSessionsMessagesListOutput:
  return DashboardInstanceSessionsMessagesListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "type": item.get('type'),
      "sender": {
        "object": item.get('sender', {}).get('object'),
        "type": item.get('sender', {}).get('type'),
        "id": item.get('sender', {}).get('id')
      },
      "mcp_message": {
        "object": item.get('mcp_message', {}).get('object'),
        "id": item.get('mcp_message', {}).get('id'),
        "method": item.get('mcp_message', {}).get('method'),
        "payload": item.get('mcp_message', {}).get('payload')
      },
      "session_id": item.get('session_id'),
      "server_session_id": item.get('server_session_id'),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

DashboardInstanceSessionsMessagesListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapDashboardInstanceSessionsMessagesListQuery(data: Dict[str, Any]) -> DashboardInstanceSessionsMessagesListQuery:
  data

