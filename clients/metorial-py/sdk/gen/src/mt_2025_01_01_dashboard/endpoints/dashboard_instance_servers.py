from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServersGetOutput, DashboardInstanceServersGetOutput

class MetorialDashboardInstanceServersEndpoint(BaseMetorialEndpoint):
  """Read and write server information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def get(self, instanceId: str, serverId: str):
    """
  Get server
  Get the information of a specific server

  :param instanceId: str
  :param serverId: str
  :return: DashboardInstanceServersGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'servers', serverId]
    )
    return self._get(request).transform(mapDashboardInstanceServersGetOutput)