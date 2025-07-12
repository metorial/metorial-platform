from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceInstanceGetOutput, DashboardInstanceInstanceGetOutput

class MetorialManagementInstanceInstanceEndpoint(BaseMetorialEndpoint):
  """Read and write instance information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def get(self, instanceId: str):
    """
  Get  instance
  Get the information of a specific  instance

  :param instanceId: str
  :return: DashboardInstanceInstanceGetOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'instance']
    )
    return self._get(request).transform(mapDashboardInstanceInstanceGetOutput)