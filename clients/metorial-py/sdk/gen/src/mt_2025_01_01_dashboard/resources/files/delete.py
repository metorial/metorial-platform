
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class FilesDeleteOutput:
  object: str
  id: str
  status: str
  file_name: str
  file_size: float
  file_type: str
  purpose: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  title: Optional[str] = None


from typing import Any, Dict
from datetime import datetime

def mapFilesDeleteOutput(data: Dict[str, Any]) -> FilesDeleteOutput:
  return FilesDeleteOutput(
  object=data.get('object'),
  id=data.get('id'),
  status=data.get('status'),
  file_name=data.get('file_name'),
  file_size=data.get('file_size'),
  file_type=data.get('file_type'),
  title=data.get('title'),
  purpose={
    "name": data.get('purpose', {}).get('name'),
    "identifier": data.get('purpose', {}).get('identifier')
  },
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  updated_at=data.get('updated_at') and datetime.fromisoformat(data.get('updated_at'))
  )

