
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ManagementInstanceLinksCreateOutput:
    object: str
    id: str
    file_id: str
    url: str
    created_at: datetime
    expires_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapManagementInstanceLinksCreateOutput(data: Dict[str, Any]) -> ManagementInstanceLinksCreateOutput:
    return ManagementInstanceLinksCreateOutput(
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
class ManagementInstanceLinksCreateBody:
    expires_at: Optional[datetime] = None


from typing import Any, Dict
from datetime import datetime

def mapManagementInstanceLinksCreateBody(data: Dict[str, Any]) -> ManagementInstanceLinksCreateBody:
    return ManagementInstanceLinksCreateBody(
    expires_at=data.get('expires_at') and datetime.fromisoformat(data.get('expires_at'))
    )

