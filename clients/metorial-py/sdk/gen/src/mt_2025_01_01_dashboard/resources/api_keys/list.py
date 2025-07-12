
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ApiKeysListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapApiKeysListOutput(data: Dict[str, Any]) -> ApiKeysListOutput:
  return ApiKeysListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "secret_redacted": item.get('secret_redacted'),
      "secret_redacted_long": item.get('secret_redacted_long'),
      "secret": item.get('secret'),
      "type": item.get('type'),
      "name": item.get('name'),
      "description": item.get('description'),
      "machine_access": {
        "object": item.get('machine_access', {}).get('object'),
        "id": item.get('machine_access', {}).get('id'),
        "status": item.get('machine_access', {}).get('status'),
        "type": item.get('machine_access', {}).get('type'),
        "name": item.get('machine_access', {}).get('name'),
        "actor": {
          "object": item.get('machine_access', {}).get('actor', {}).get('object'),
          "id": item.get('machine_access', {}).get('actor', {}).get('id'),
          "type": item.get('machine_access', {}).get('actor', {}).get('type'),
          "organization_id": item.get('machine_access', {}).get('actor', {}).get('organization_id'),
          "actor_id": item.get('machine_access', {}).get('actor', {}).get('actor_id'),
          "name": item.get('machine_access', {}).get('actor', {}).get('name'),
          "email": item.get('machine_access', {}).get('actor', {}).get('email'),
          "image_url": item.get('machine_access', {}).get('actor', {}).get('image_url'),
          "created_at": item.get('machine_access', {}).get('actor', {}).get('created_at') and datetime.fromisoformat(item.get('machine_access', {}).get('actor', {}).get('created_at')),
          "updated_at": item.get('machine_access', {}).get('actor', {}).get('updated_at') and datetime.fromisoformat(item.get('machine_access', {}).get('actor', {}).get('updated_at'))
        },
        "instance": {
          "object": item.get('machine_access', {}).get('instance', {}).get('object'),
          "id": item.get('machine_access', {}).get('instance', {}).get('id'),
          "status": item.get('machine_access', {}).get('instance', {}).get('status'),
          "slug": item.get('machine_access', {}).get('instance', {}).get('slug'),
          "name": item.get('machine_access', {}).get('instance', {}).get('name'),
          "type": item.get('machine_access', {}).get('instance', {}).get('type'),
          "organization_id": item.get('machine_access', {}).get('instance', {}).get('organization_id'),
          "project": {
            "object": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('object'),
            "id": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('id'),
            "status": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('status'),
            "slug": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('slug'),
            "name": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('name'),
            "organization_id": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('organization_id'),
            "created_at": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('created_at') and datetime.fromisoformat(item.get('machine_access', {}).get('instance', {}).get('project', {}).get('created_at')),
            "updated_at": item.get('machine_access', {}).get('instance', {}).get('project', {}).get('updated_at') and datetime.fromisoformat(item.get('machine_access', {}).get('instance', {}).get('project', {}).get('updated_at'))
          },
          "created_at": item.get('machine_access', {}).get('instance', {}).get('created_at') and datetime.fromisoformat(item.get('machine_access', {}).get('instance', {}).get('created_at')),
          "updated_at": item.get('machine_access', {}).get('instance', {}).get('updated_at') and datetime.fromisoformat(item.get('machine_access', {}).get('instance', {}).get('updated_at'))
        },
        "organization_id": {
          "object": item.get('machine_access', {}).get('organization_id', {}).get('object'),
          "id": item.get('machine_access', {}).get('organization_id', {}).get('id'),
          "status": item.get('machine_access', {}).get('organization_id', {}).get('status'),
          "type": item.get('machine_access', {}).get('organization_id', {}).get('type'),
          "slug": item.get('machine_access', {}).get('organization_id', {}).get('slug'),
          "name": item.get('machine_access', {}).get('organization_id', {}).get('name'),
          "organization_id": item.get('machine_access', {}).get('organization_id', {}).get('organization_id'),
          "image_url": item.get('machine_access', {}).get('organization_id', {}).get('image_url'),
          "created_at": item.get('machine_access', {}).get('organization_id', {}).get('created_at') and datetime.fromisoformat(item.get('machine_access', {}).get('organization_id', {}).get('created_at')),
          "updated_at": item.get('machine_access', {}).get('organization_id', {}).get('updated_at') and datetime.fromisoformat(item.get('machine_access', {}).get('organization_id', {}).get('updated_at'))
        },
        "user": {
          "object": item.get('machine_access', {}).get('user', {}).get('object'),
          "id": item.get('machine_access', {}).get('user', {}).get('id'),
          "status": item.get('machine_access', {}).get('user', {}).get('status'),
          "type": item.get('machine_access', {}).get('user', {}).get('type'),
          "email": item.get('machine_access', {}).get('user', {}).get('email'),
          "name": item.get('machine_access', {}).get('user', {}).get('name'),
          "first_name": item.get('machine_access', {}).get('user', {}).get('first_name'),
          "last_name": item.get('machine_access', {}).get('user', {}).get('last_name'),
          "image_url": item.get('machine_access', {}).get('user', {}).get('image_url'),
          "created_at": item.get('machine_access', {}).get('user', {}).get('created_at') and datetime.fromisoformat(item.get('machine_access', {}).get('user', {}).get('created_at')),
          "updated_at": item.get('machine_access', {}).get('user', {}).get('updated_at') and datetime.fromisoformat(item.get('machine_access', {}).get('user', {}).get('updated_at'))
        },
        "deleted_at": item.get('machine_access', {}).get('deleted_at') and datetime.fromisoformat(item.get('machine_access', {}).get('deleted_at')),
        "last_used_at": item.get('machine_access', {}).get('last_used_at') and datetime.fromisoformat(item.get('machine_access', {}).get('last_used_at')),
        "created_at": item.get('machine_access', {}).get('created_at') and datetime.fromisoformat(item.get('machine_access', {}).get('created_at')),
        "updated_at": item.get('machine_access', {}).get('updated_at') and datetime.fromisoformat(item.get('machine_access', {}).get('updated_at'))
      },
      "deleted_at": item.get('deleted_at') and datetime.fromisoformat(item.get('deleted_at')),
      "last_used_at": item.get('last_used_at') and datetime.fromisoformat(item.get('last_used_at')),
      "expires_at": item.get('expires_at') and datetime.fromisoformat(item.get('expires_at')),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
      "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at')),
      "reveal_info": {
        "until": item.get('reveal_info', {}).get('until') and datetime.fromisoformat(item.get('reveal_info', {}).get('until')),
        "forever": item.get('reveal_info', {}).get('forever')
      }
    } for item in data.get('items', [])],
  pagination={
    "has_more_before": data.get('pagination', {}).get('has_more_before'),
    "has_more_after": data.get('pagination', {}).get('has_more_after')
  }
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ApiKeysListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapApiKeysListQuery(data: Dict[str, Any]) -> ApiKeysListQuery:
  data

