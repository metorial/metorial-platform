
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from datetime import datetime

@dataclass
class ServersCapabilitiesListOutput:
  object: str
  mcp_servers: List[Dict[str, Any]]
  tools: List[Dict[str, Any]]
  prompts: List[Dict[str, Any]]
  resource_templates: List[Dict[str, Any]]


from typing import Any, Dict
from datetime import datetime

def mapServersCapabilitiesListOutput(data: Dict[str, Any]) -> ServersCapabilitiesListOutput:
  return ServersCapabilitiesListOutput(
  object=data.get('object'),
  mcp_servers=[{
      "object": item.get('object'),
      "id": item.get('id'),
      "server": {
        "object": item.get('server', {}).get('object'),
        "id": item.get('server', {}).get('id'),
        "name": item.get('server', {}).get('name'),
        "description": item.get('server', {}).get('description'),
        "type": item.get('server', {}).get('type'),
        "created_at": item.get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server', {}).get('created_at')),
        "updated_at": item.get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server', {}).get('updated_at'))
      },
      "server_variant": {
        "object": item.get('server_variant', {}).get('object'),
        "id": item.get('server_variant', {}).get('id'),
        "identifier": item.get('server_variant', {}).get('identifier'),
        "server_id": item.get('server_variant', {}).get('server_id'),
        "source": item.get('server_variant', {}).get('source'),
        "created_at": item.get('server_variant', {}).get('created_at') and datetime.fromisoformat(item.get('server_variant', {}).get('created_at'))
      },
      "server_version": {
        "object": item.get('server_version', {}).get('object'),
        "id": item.get('server_version', {}).get('id'),
        "identifier": item.get('server_version', {}).get('identifier'),
        "server_id": item.get('server_version', {}).get('server_id'),
        "server_variant_id": item.get('server_version', {}).get('server_variant_id'),
        "source": item.get('server_version', {}).get('source'),
        "created_at": item.get('server_version', {}).get('created_at') and datetime.fromisoformat(item.get('server_version', {}).get('created_at'))
      },
      "server_deployment": {
        "object": item.get('server_deployment', {}).get('object'),
        "id": item.get('server_deployment', {}).get('id'),
        "name": item.get('server_deployment', {}).get('name'),
        "description": item.get('server_deployment', {}).get('description'),
        "metadata": item.get('server_deployment', {}).get('metadata'),
        "created_at": item.get('server_deployment', {}).get('created_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('created_at')),
        "updated_at": item.get('server_deployment', {}).get('updated_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('updated_at')),
        "server": {
          "object": item.get('server_deployment', {}).get('server', {}).get('object'),
          "id": item.get('server_deployment', {}).get('server', {}).get('id'),
          "name": item.get('server_deployment', {}).get('server', {}).get('name'),
          "description": item.get('server_deployment', {}).get('server', {}).get('description'),
          "type": item.get('server_deployment', {}).get('server', {}).get('type'),
          "created_at": item.get('server_deployment', {}).get('server', {}).get('created_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('server', {}).get('created_at')),
          "updated_at": item.get('server_deployment', {}).get('server', {}).get('updated_at') and datetime.fromisoformat(item.get('server_deployment', {}).get('server', {}).get('updated_at'))
        }
      },
      "capabilities": item.get('capabilities'),
      "info": {
        "name": item.get('info', {}).get('name'),
        "version": item.get('info', {}).get('version')
      }
    } for item in data.get('mcp_servers', [])],
  tools=[{
      "mcp_server_id": item.get('mcp_server_id'),
      "name": item.get('name'),
      "description": item.get('description'),
      "input_schema": item.get('inputSchema'),
      "output_schema": item.get('outputSchema'),
      "annotations": item.get('annotations')
    } for item in data.get('tools', [])],
  prompts=[{
      "mcp_server_id": item.get('mcp_server_id'),
      "name": item.get('name'),
      "description": item.get('description'),
      "arguments": item.get('arguments')
    } for item in data.get('prompts', [])],
  resource_templates=[{
      "mcp_server_id": item.get('mcp_server_id'),
      "uri_template": item.get('uriTemplate'),
      "name": item.get('name'),
      "description": item.get('description'),
      "mime_type": item.get('mimeType')
    } for item in data.get('resourceTemplates', [])]
  )


from typing import Any, Dict, List, Optional, Union
from datetime import datetime

ServersCapabilitiesListQuery = Any


from typing import Any, Dict
from datetime import datetime

def mapServersCapabilitiesListQuery(data: Dict[str, Any]) -> ServersCapabilitiesListQuery:
  data

