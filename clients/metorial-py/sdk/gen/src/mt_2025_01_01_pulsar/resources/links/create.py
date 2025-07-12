
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class LinksCreateOutput:
  object: str
  id: str
  file_id: str
  url: str
  created_at: datetime
  expires_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapLinksCreateOutput(data: Dict[str, Any]) -> LinksCreateOutput:
  return LinksCreateOutput(
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
class LinksCreateBody:
  expires_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapLinksCreateBody(data: Dict[str, Any]) -> LinksCreateBody:
  return LinksCreateBody(
  expires_at=data.get('expires_at') and datetime.fromisoformat(data.get('expires_at'))
  )

