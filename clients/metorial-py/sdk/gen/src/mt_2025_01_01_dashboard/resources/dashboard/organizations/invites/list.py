
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardOrganizationsInvitesListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapDashboardOrganizationsInvitesListOutput(data: Dict[str, Any]) -> DashboardOrganizationsInvitesListOutput:
  return DashboardOrganizationsInvitesListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "role": item.get('role'),
      "type": item.get('type'),
      "email": item.get('email'),
      "organization": {
        "object": item.get('organization', {}).get('object'),
        "id": item.get('organization', {}).get('id'),
        "status": item.get('organization', {}).get('status'),
        "type": item.get('organization', {}).get('type'),
        "slug": item.get('organization', {}).get('slug'),
        "name": item.get('organization', {}).get('name'),
        "organization_id": item.get('organization', {}).get('organization_id'),
        "image_url": item.get('organization', {}).get('image_url'),
        "created_at": item.get('organization', {}).get('created_at') and datetime.fromisoformat(item.get('organization', {}).get('created_at')),
        "updated_at": item.get('organization', {}).get('updated_at') and datetime.fromisoformat(item.get('organization', {}).get('updated_at'))
      },
      "invited_by": {
        "object": item.get('invited_by', {}).get('object'),
        "id": item.get('invited_by', {}).get('id'),
        "type": item.get('invited_by', {}).get('type'),
        "organization_id": item.get('invited_by', {}).get('organization_id'),
        "actor_id": item.get('invited_by', {}).get('actor_id'),
        "name": item.get('invited_by', {}).get('name'),
        "email": item.get('invited_by', {}).get('email'),
        "image_url": item.get('invited_by', {}).get('image_url'),
        "created_at": item.get('invited_by', {}).get('created_at') and datetime.fromisoformat(item.get('invited_by', {}).get('created_at')),
        "updated_at": item.get('invited_by', {}).get('updated_at') and datetime.fromisoformat(item.get('invited_by', {}).get('updated_at'))
      },
      "invite_link": {
        "_typename": item.get('inviteLink', {}).get('__typename'),
        "id": item.get('inviteLink', {}).get('id'),
        "key": item.get('inviteLink', {}).get('key'),
        "key_redacted": item.get('inviteLink', {}).get('keyRedacted'),
        "url": item.get('inviteLink', {}).get('url'),
        "created_at": item.get('inviteLink', {}).get('created_at') and datetime.fromisoformat(item.get('inviteLink', {}).get('created_at'))
      },
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
      "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at')),
      "deleted_at": item.get('deletedAt') and datetime.fromisoformat(item.get('deletedAt')),
      "expires_at": item.get('expiresAt') and datetime.fromisoformat(item.get('expiresAt')),
      "accepted_at": item.get('acceptedAt') and datetime.fromisoformat(item.get('acceptedAt')),
      "rejected_at": item.get('rejectedAt') and datetime.fromisoformat(item.get('rejectedAt'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

DashboardOrganizationsInvitesListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapDashboardOrganizationsInvitesListQuery(data: Dict[str, Any]) -> DashboardOrganizationsInvitesListQuery:
  data

