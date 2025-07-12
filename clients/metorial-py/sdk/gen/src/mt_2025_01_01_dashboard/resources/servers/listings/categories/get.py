
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersListingsCategoriesGetOutput:
  object: str
  id: str
  name: str
  slug: str
  description: str
  created_at: datetime
  updated_at: datetime


from typing import Any, Dict
from datetime import datetime

def mapServersListingsCategoriesGetOutput(data: Dict[str, Any]) -> ServersListingsCategoriesGetOutput:
  return ServersListingsCategoriesGetOutput(
  object=data.get('object'),
  id=data.get('id'),
  name=data.get('name'),
  slug=data.get('slug'),
  description=data.get('description'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

