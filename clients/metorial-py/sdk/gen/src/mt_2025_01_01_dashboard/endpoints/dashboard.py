from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardBootOutput, DashboardBootOutput, mapDashboardBootBody, DashboardBootBody

class MetorialDashboardEndpoint(BaseMetorialEndpoint):
  """Boot user"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def boot(self, body: DashboardBootBody):
    """
  Create organization
  Create a new organization

  :param body: DashboardBootBody
  :return: DashboardBootOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'boot'],
      body=mapDashboardBootBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardBootOutput)