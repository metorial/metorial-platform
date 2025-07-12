
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardBootOutput:
  object: str
  user: Dict[str, Any]
  organizations: List[Any]
  projects: List[Any]
  instances: List[Any]


from typing import Any, Dict
from datetime import datetime

def mapDashboardBootOutput(data: Dict[str, Any]) -> DashboardBootOutput:
  return DashboardBootOutput(
  object=data.get('object'),
  user={
    "object": data.get('user', {}).get('object'),
    "id": data.get('user', {}).get('id'),
    "status": data.get('user', {}).get('status'),
    "type": data.get('user', {}).get('type'),
    "email": data.get('user', {}).get('email'),
    "name": data.get('user', {}).get('name'),
    "first_name": data.get('user', {}).get('first_name'),
    "last_name": data.get('user', {}).get('last_name'),
    "image_url": data.get('user', {}).get('image_url'),
    "created_at": data.get('user', {}).get('created_at') and datetime.fromisoformat(data.get('user', {}).get('created_at')),
    "updated_at": data.get('user', {}).get('updated_at') and datetime.fromisoformat(data.get('user', {}).get('updated_at'))
  },
  organizations=[            item for item in data.get('organizations', [])],
  projects=[            item for item in data.get('projects', [])],
  instances=[            item for item in data.get('instances', [])]
  )


from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardBootBody:
  pass


from typing import Any, Dict
from datetime import datetime

def mapDashboardBootBody(data: Dict[str, Any]) -> DashboardBootBody:
  return DashboardBootBody(

  )

