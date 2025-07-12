
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class DashboardOrganizationsInstancesListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapDashboardOrganizationsInstancesListOutput(data: Dict[str, Any]) -> DashboardOrganizationsInstancesListOutput:
  return DashboardOrganizationsInstancesListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "slug": item.get('slug'),
      "name": item.get('name'),
      "type": item.get('type'),
      "organization_id": item.get('organization_id'),
      "project": {
        "object": item.get('project', {}).get('object'),
        "id": item.get('project', {}).get('id'),
        "status": item.get('project', {}).get('status'),
        "slug": item.get('project', {}).get('slug'),
        "name": item.get('project', {}).get('name'),
        "organization_id": item.get('project', {}).get('organization_id'),
        "created_at": item.get('project', {}).get('created_at') and datetime.fromisoformat(item.get('project', {}).get('created_at')),
        "updated_at": item.get('project', {}).get('updated_at') and datetime.fromisoformat(item.get('project', {}).get('updated_at'))
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

DashboardOrganizationsInstancesListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapDashboardOrganizationsInstancesListQuery(data: Dict[str, Any]) -> DashboardOrganizationsInstancesListQuery:
  data

