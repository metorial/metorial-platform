
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class FilesListOutput:
  items: List[Dict[str, Any]]
  pagination: Dict[str, Any]


from typing import Any, Dict
from datetime import datetime

def mapFilesListOutput(data: Dict[str, Any]) -> FilesListOutput:
  return FilesListOutput(
  items=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "status": item.get('status'),
      "file_name": item.get('file_name'),
      "file_size": item.get('file_size'),
      "file_type": item.get('file_type'),
      "title": item.get('title'),
      "purpose": {
        "name": item.get('purpose', {}).get('name'),
        "identifier": item.get('purpose', {}).get('identifier')
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

FilesListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapFilesListQuery(data: Dict[str, Any]) -> FilesListQuery:
  data

