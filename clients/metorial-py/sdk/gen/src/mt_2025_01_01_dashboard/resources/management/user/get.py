
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementUserGetOutput:
  object: str
  id: str
  status: str
  type: str
  email: str
  name: str
  first_name: str
  last_name: str
  image_url: str
  created_at: datetime
  updated_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapManagementUserGetOutput(data: Dict[str, Any]) -> ManagementUserGetOutput:
  return ManagementUserGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  type=data.get('type'),
  email=data.get('email'),
  name=data.get('name'),
  first_name=data.get('first_name'),
  last_name=data.get('last_name'),
  image_url=data.get('image_url'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

