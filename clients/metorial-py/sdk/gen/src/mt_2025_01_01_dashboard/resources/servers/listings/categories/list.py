
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersListingsCategoriesListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapServersListingsCategoriesListOutput(data: Dict[str, Any]) -> ServersListingsCategoriesListOutput:
  return ServersListingsCategoriesListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "name": item.get('name'),
      "slug": item.get('slug'),
      "description": item.get('description'),
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

ServersListingsCategoriesListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServersListingsCategoriesListQuery(data: Dict[str, Any]) -> ServersListingsCategoriesListQuery:
  data

