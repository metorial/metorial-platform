
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersListingsGetOutput:
  object: str
  id: str
  status: str
  slug: str
  name: str
  description: str
  readme: str
  categories: List[Dict[str, Any]]
  skills: List[str]
  is_official: bool
  is_community: bool
  is_hostable: bool
  server: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  vendor: Optional[Dict[str, Any]] = None
  repository: Optional[Dict[str, Any]] = None
  installation: Optional[Dict[str, Any]] = None


from typing import Any, Dict
from datetime import datetime

def mapServersListingsGetOutput(data: Dict[str, Any]) -> ServersListingsGetOutput:
  return ServersListingsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  slug=data.get('slug'),
  name=data.get('name'),
  description=data.get('description'),
  readme=data.get('readme'),
  categories=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "name": item.get('name'),
      "slug": item.get('slug'),
      "description": item.get('description'),
      "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
      "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at'))
    } for item in data.get('categories', [])],
  skills=[            item for item in data.get('skills', [])],
  is_official=data.get('is_official'),
  is_community=data.get('is_community'),
  is_hostable=data.get('is_hostable'),
  server={
    "object": data.get('server', {}).get('object'),
    "id": data.get('server', {}).get('id'),
    "name": data.get('server', {}).get('name'),
    "description": data.get('server', {}).get('description'),
    "type": data.get('server', {}).get('type'),
    "created_at": data.get('server', {}).get('created_at') and datetime.fromisoformat(data.get('server', {}).get('created_at')),
    "updated_at": data.get('server', {}).get('updated_at') and datetime.fromisoformat(data.get('server', {}).get('updated_at'))
  },
  vendor={
    "id": data.get('vendor', {}).get('id'),
    "identifier": data.get('vendor', {}).get('identifier'),
    "name": data.get('vendor', {}).get('name'),
    "description": data.get('vendor', {}).get('description'),
    "image_url": data.get('vendor', {}).get('image_url'),
    "attributes": data.get('vendor', {}).get('attributes'),
    "created_at": data.get('vendor', {}).get('created_at') and datetime.fromisoformat(data.get('vendor', {}).get('created_at')),
    "updated_at": data.get('vendor', {}).get('updated_at') and datetime.fromisoformat(data.get('vendor', {}).get('updated_at'))
  },
  repository={
    "id": data.get('repository', {}).get('id'),
    "identifier": data.get('repository', {}).get('identifier'),
    "slug": data.get('repository', {}).get('slug'),
    "name": data.get('repository', {}).get('name'),
    "provider_url": data.get('repository', {}).get('provider_url'),
    "website_url": data.get('repository', {}).get('website_url'),
    "provider": data.get('repository', {}).get('provider'),
    "star_count": data.get('repository', {}).get('star_count'),
    "fork_count": data.get('repository', {}).get('fork_count'),
    "watcher_count": data.get('repository', {}).get('watcher_count'),
    "open_issues_count": data.get('repository', {}).get('open_issues_count'),
    "subscription_count": data.get('repository', {}).get('subscription_count'),
    "default_branch": data.get('repository', {}).get('default_branch'),
    "license_name": data.get('repository', {}).get('license_name'),
    "license_url": data.get('repository', {}).get('license_url'),
    "license_spdx_id": data.get('repository', {}).get('license_spdx_id'),
    "topics": [                item for item in data.get('repository', {}).get('topics', [])],
    "language": data.get('repository', {}).get('language'),
    "description": data.get('repository', {}).get('description'),
    "created_at": data.get('repository', {}).get('created_at') and datetime.fromisoformat(data.get('repository', {}).get('created_at')),
    "updated_at": data.get('repository', {}).get('updated_at') and datetime.fromisoformat(data.get('repository', {}).get('updated_at')),
    "pushed_at": data.get('repository', {}).get('pushed_at') and datetime.fromisoformat(data.get('repository', {}).get('pushed_at'))
  },
  installation={
    "id": data.get('installation', {}).get('id'),
    "instance_id": data.get('installation', {}).get('instance_id'),
    "created_at": data.get('installation', {}).get('created_at') and datetime.fromisoformat(data.get('installation', {}).get('created_at'))
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

