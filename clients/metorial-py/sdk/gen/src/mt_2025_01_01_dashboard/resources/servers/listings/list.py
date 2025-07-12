
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersListingsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServersListingsListOutput(data: Dict[str, Any]) -> ServersListingsListOutput:
  return ServersListingsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "slug": item.get('slug'),
      "name": item.get('name'),
      "description": item.get('description'),
      "readme": item.get('readme'),
      "categories": [{
          "object": item.get('object'),
          "id": item.get('id'),
          "name": item.get('name'),
          "slug": item.get('slug'),
          "description": item.get('description'),
          "created_at": item.get('created_at') and datetime.fromisoformat(item.get('created_at')),
          "updated_at": item.get('updated_at') and datetime.fromisoformat(item.get('updated_at'))
        } for item in item.get('categories', [])],
      "skills": [                    item for item in item.get('skills', [])],
      "is_official": item.get('is_official'),
      "is_community": item.get('is_community'),
      "is_hostable": item.get('is_hostable'),
      "server": {
        "object": item.get('server', {}).get('object'),
        "id": item.get('server', {}).get('id'),
        "name": item.get('server', {}).get('name'),
        "description": item.get('server', {}).get('description'),
        "type": item.get('server', {}).get('type'),
        "created_at": item.get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server', {}).get('created_at')),
        "updated_at": item.get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server', {}).get('updated_at'))
      },
      "vendor": {
        "id": item.get('vendor', {}).get('id'),
        "identifier": item.get('vendor', {}).get('identifier'),
        "name": item.get('vendor', {}).get('name'),
        "description": item.get('vendor', {}).get('description'),
        "image_url": item.get('vendor', {}).get('image_url'),
        "attributes": item.get('vendor', {}).get('attributes'),
        "created_at": item.get('vendor', {}).get('created_at') and datetime.fromisoformat(item.get('vendor', {}).get('created_at')),
        "updated_at": item.get('vendor', {}).get('updated_at') and datetime.fromisoformat(item.get('vendor', {}).get('updated_at'))
      },
      "repository": {
        "id": item.get('repository', {}).get('id'),
        "identifier": item.get('repository', {}).get('identifier'),
        "slug": item.get('repository', {}).get('slug'),
        "name": item.get('repository', {}).get('name'),
        "provider_url": item.get('repository', {}).get('provider_url'),
        "website_url": item.get('repository', {}).get('website_url'),
        "provider": item.get('repository', {}).get('provider'),
        "star_count": item.get('repository', {}).get('star_count'),
        "fork_count": item.get('repository', {}).get('fork_count'),
        "watcher_count": item.get('repository', {}).get('watcher_count'),
        "open_issues_count": item.get('repository', {}).get('open_issues_count'),
        "subscription_count": item.get('repository', {}).get('subscription_count'),
        "default_branch": item.get('repository', {}).get('default_branch'),
        "license_name": item.get('repository', {}).get('license_name'),
        "license_url": item.get('repository', {}).get('license_url'),
        "license_spdx_id": item.get('repository', {}).get('license_spdx_id'),
        "topics": [                        item for item in item.get('repository', {}).get('topics', [])],
        "language": item.get('repository', {}).get('language'),
        "description": item.get('repository', {}).get('description'),
        "created_at": item.get('repository', {}).get('created_at') and datetime.fromisoformat(item.get('repository', {}).get('created_at')),
        "updated_at": item.get('repository', {}).get('updated_at') and datetime.fromisoformat(item.get('repository', {}).get('updated_at')),
        "pushed_at": item.get('repository', {}).get('pushed_at') and datetime.fromisoformat(item.get('repository', {}).get('pushed_at'))
      },
      "installation": {
        "id": item.get('installation', {}).get('id'),
        "instance_id": item.get('installation', {}).get('instance_id'),
        "created_at": item.get('installation', {}).get('created_at') and datetime.fromisoformat(item.get('installation', {}).get('created_at'))
      },
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

ServersListingsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServersListingsListQuery(data: Dict[str, Any]) -> ServersListingsListQuery:
  data

