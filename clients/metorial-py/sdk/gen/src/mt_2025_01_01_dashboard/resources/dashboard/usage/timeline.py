
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardUsageTimelineOutput:
  object: str
  timeline: List[Dict[str, Any]]


from typing import Any, Dict
from datetime import datetime

def mapDashboardUsageTimelineOutput(data: Dict[str, Any]) -> DashboardUsageTimelineOutput:
  return DashboardUsageTimelineOutput(
  object=data.get('object'),
  timeline=[{
      "entity_id": item.get('entity_id'),
      "entity_type": item.get('entity_type'),
      "owner_id": item.get('owner_id'),
      "entries": [{
          "ts": item.get('ts') and datetime.fromisoformat(item.get('ts')),
          "count": item.get('count')
        } for item in item.get('entries', [])]
    } for item in data.get('timeline', [])]
  )


from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardUsageTimelineQuery:
  entities: List[Dict[str, Any]]
  from_: datetime
  to: datetime
  interval: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapDashboardUsageTimelineQuery(data: Dict[str, Any]) -> DashboardUsageTimelineQuery:
  return DashboardUsageTimelineQuery(
  entities=[{
      "type": item.get('type'),
      "id": item.get('id')
    } for item in data.get('entities', [])],
  from_=data.get('from') and datetime.fromisoformat(data.get('from')),
  to=data.get('to') and datetime.fromisoformat(data.get('to')),
  interval={
    "unit": data.get('interval', {}).get('unit'),
    "count": data.get('interval', {}).get('count')
  }
  )

