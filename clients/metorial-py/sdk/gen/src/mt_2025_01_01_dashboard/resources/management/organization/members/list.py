
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementOrganizationMembersListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapManagementOrganizationMembersListOutput(data: Dict[str, Any]) -> ManagementOrganizationMembersListOutput:
  return ManagementOrganizationMembersListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "role": item.get('role'),
      "user_id": item.get('user_id'),
      "organization_id": item.get('organization_id'),
      "actor_id": item.get('actor_id'),
      "actor": {
        "object": item.get('actor', {}).get('object'),
        "id": item.get('actor', {}).get('id'),
        "type": item.get('actor', {}).get('type'),
        "organization_id": item.get('actor', {}).get('organization_id'),
        "actor_id": item.get('actor', {}).get('actor_id'),
        "name": item.get('actor', {}).get('name'),
        "email": item.get('actor', {}).get('email'),
        "image_url": item.get('actor', {}).get('image_url'),
        "created_at": item.get('actor', {}).get('created_at') and datetime.fromisoformat(item.get('actor', {}).get('created_at')),
        "updated_at": item.get('actor', {}).get('updated_at') and datetime.fromisoformat(item.get('actor', {}).get('updated_at'))
      },
      "last_active_at": item.get('last_active_at') and datetime.fromisoformat(item.get('last_active_at')),
      "deleted_at": item.get('deleted_at') and datetime.fromisoformat(item.get('deleted_at')),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
      "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at'))
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ManagementOrganizationMembersListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapManagementOrganizationMembersListQuery(data: Dict[str, Any]) -> ManagementOrganizationMembersListQuery:
  data

