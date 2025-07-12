
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementOrganizationProjectsGetOutput:
  object: str
  id: str
  status: str
  slug: str
  name: str
  organization_id: str
  created_at: datetime
  updated_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapManagementOrganizationProjectsGetOutput(data: Dict[str, Any]) -> ManagementOrganizationProjectsGetOutput:
  return ManagementOrganizationProjectsGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  slug=data.get('slug'),
  name=data.get('name'),
  organization_id=data.get('organization_id'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

