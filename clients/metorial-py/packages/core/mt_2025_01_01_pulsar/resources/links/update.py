
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class LinksUpdateOutput:
  object: str
  id: str
  file_id: str
  url: str
  created_at: datetime
  expires_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapLinksUpdateOutput(data: Dict[str, Any]) -> LinksUpdateOutput:
  return LinksUpdateOutput(
  object=data.get('object'),
  id=data.get('id'),
  file_id=data.get('file_id'),
  url=data.get('url'),
  created_at=data.get('created_at') and datetime.fromisoformat(data.get('created_at')),
  expires_at=data.get('expires_at') and datetime.fromisoformat(data.get('expires_at'))
  )


from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class LinksUpdateBody:
  expires_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapLinksUpdateBody(data: Dict[str, Any]) -> LinksUpdateBody:
  return LinksUpdateBody(
  expires_at=data.get('expires_at') and datetime.fromisoformat(data.get('expires_at'))
  )

