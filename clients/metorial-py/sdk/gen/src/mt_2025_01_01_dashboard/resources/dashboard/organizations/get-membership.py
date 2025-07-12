
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardOrganizationsGetMembershipOutput:
  object: str
  id: str
  status: str
  role: str
  user_id: str
  organization_id: str
  actor_id: str
  actor: Dict[str, Any]
  last_active_at: datetime
  deleted_at: datetime
  created_at: datetime
  updated_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapDashboardOrganizationsGetMembershipOutput(data: Dict[str, Any]) -> DashboardOrganizationsGetMembershipOutput:
  return DashboardOrganizationsGetMembershipOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  role=data.get('role'),
  user_id=data.get('user_id'),
  organization_id=data.get('organization_id'),
  actor_id=data.get('actor_id'),
  actor={
    "object": data.get('actor', {}).get('object'),
    "id": data.get('actor', {}).get('id'),
    "type": data.get('actor', {}).get('type'),
    "organization_id": data.get('actor', {}).get('organization_id'),
    "actor_id": data.get('actor', {}).get('actor_id'),
    "name": data.get('actor', {}).get('name'),
    "email": data.get('actor', {}).get('email'),
    "image_url": data.get('actor', {}).get('image_url'),
    "created_at": data.get('actor', {}).get('created_at') and datetime.fromisoformat(data.get('actor', {}).get('created_at')),
    "updated_at": data.get('actor', {}).get('updated_at') and datetime.fromisoformat(data.get('actor', {}).get('updated_at'))
  },
  last_active_at=data.get('last_active_at') and datetime.fromisoformat(data.get('last_active_at')),
  deleted_at=data.get('deleted_at') and datetime.fromisoformat(data.get('deleted_at')),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

