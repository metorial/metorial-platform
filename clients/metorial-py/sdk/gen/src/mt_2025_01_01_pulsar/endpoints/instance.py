from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceInstanceGetOutput, DashboardInstanceInstanceGetOutput

class MetorialInstanceEndpoint(BaseMetorialEndpoint):
  """Read and write instance information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def get(self):
    """
  Get  instance
  Get the information of a specific  instance


  :return: DashboardInstanceInstanceGetOutput
  """
    request = MetorialRequest(
      path=['instance']
    )
    return self._get(request).transform(mapDashboardInstanceInstanceGetOutput)