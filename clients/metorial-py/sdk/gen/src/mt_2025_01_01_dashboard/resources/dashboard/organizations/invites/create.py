
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardOrganizationsInvitesCreateOutput:
  object: str
  id: str
  status: str
  role: str
  type: str
  email: str
  organization: Dict[str, Any]
  invited_by: Dict[str, Any]
  invite_link: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  deleted_at: datetime
  expires_at: datetime
  accepted_at: datetime
  rejected_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapDashboardOrganizationsInvitesCreateOutput(data: Dict[str, Any]) -> DashboardOrganizationsInvitesCreateOutput:
  return DashboardOrganizationsInvitesCreateOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  role=data.get('role'),
  type=data.get('type'),
  email=data.get('email'),
  organization={
    "object": data.get('organization', {}).get('object'),
    "id": data.get('organization', {}).get('id'),
    "status": data.get('organization', {}).get('status'),
    "type": data.get('organization', {}).get('type'),
    "slug": data.get('organization', {}).get('slug'),
    "name": data.get('organization', {}).get('name'),
    "organization_id": data.get('organization', {}).get('organization_id'),
    "image_url": data.get('organization', {}).get('image_url'),
    "created_at": data.get('organization', {}).get('created_at') and datetime.fromisoformat(data.get('organization', {}).get('created_at')),
    "updated_at": data.get('organization', {}).get('updated_at') and datetime.fromisoformat(data.get('organization', {}).get('updated_at'))
  },
  invited_by={
    "object": data.get('invited_by', {}).get('object'),
    "id": data.get('invited_by', {}).get('id'),
    "type": data.get('invited_by', {}).get('type'),
    "organization_id": data.get('invited_by', {}).get('organization_id'),
    "actor_id": data.get('invited_by', {}).get('actor_id'),
    "name": data.get('invited_by', {}).get('name'),
    "email": data.get('invited_by', {}).get('email'),
    "image_url": data.get('invited_by', {}).get('image_url'),
    "created_at": data.get('invited_by', {}).get('created_at') and datetime.fromisoformat(data.get('invited_by', {}).get('created_at')),
    "updated_at": data.get('invited_by', {}).get('updated_at') and datetime.fromisoformat(data.get('invited_by', {}).get('updated_at'))
  },
  invite_link={
    "_typename": data.get('inviteLink', {}).get('__typename'),
    "id": data.get('inviteLink', {}).get('id'),
    "key": data.get('inviteLink', {}).get('key'),
    "key_redacted": data.get('inviteLink', {}).get('keyRedacted'),
    "url": data.get('inviteLink', {}).get('url'),
    "created_at": data.get('inviteLink', {}).get('created_at') and datetime.fromisoformat(data.get('inviteLink', {}).get('created_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at')),
  deleted_at=data.get('deletedAt') and datetime.fromisoformat(data.get('deletedAt')),
  expires_at=data.get('expiresAt') and datetime.fromisoformat(data.get('expiresAt')),
  accepted_at=data.get('acceptedAt') and datetime.fromisoformat(data.get('acceptedAt')),
  rejected_at=data.get('rejectedAt') and datetime.fromisoformat(data.get('rejectedAt'))
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

DashboardOrganizationsInvitesCreateBody = Union[Dict[str, Any], Dict[str, Any]]


from typing import Any, Dict
from datetime import datetime

def mapDashboardOrganizationsInvitesCreateBody(data: Dict[str, Any]) -> DashboardOrganizationsInvitesCreateBody:
  data

