
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementOrganizationProjectsListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapManagementOrganizationProjectsListOutput(data: Dict[str, Any]) -> ManagementOrganizationProjectsListOutput:
  return ManagementOrganizationProjectsListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "slug": item.get('slug'),
      "name": item.get('name'),
      "organization_id": item.get('organization_id'),
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

ManagementOrganizationProjectsListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapManagementOrganizationProjectsListQuery(data: Dict[str, Any]) -> ManagementOrganizationProjectsListQuery:
  data

