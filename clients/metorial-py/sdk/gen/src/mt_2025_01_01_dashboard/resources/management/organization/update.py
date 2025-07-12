
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementOrganizationUpdateOutput:
  object: str
  id: str
  status: str
  type: str
  slug: str
  name: str
  organization_id: str
  image_url: str
  created_at: datetime
  updated_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapManagementOrganizationUpdateOutput(data: Dict[str, Any]) -> ManagementOrganizationUpdateOutput:
  return ManagementOrganizationUpdateOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  type=data.get('type'),
  slug=data.get('slug'),
  name=data.get('name'),
  organization_id=data.get('organization_id'),
  image_url=data.get('image_url'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )


from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementOrganizationUpdateBody:
  name: Optional[str] = None


from typing import Any, Dict
from datetime import datetime

def mapManagementOrganizationUpdateBody(data: Dict[str, Any]) -> ManagementOrganizationUpdateBody:
  return ManagementOrganizationUpdateBody(
  name=data.get('name')
  )

