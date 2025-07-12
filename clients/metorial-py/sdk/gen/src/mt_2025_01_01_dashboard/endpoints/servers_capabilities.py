from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServersCapabilitiesListOutput, DashboardInstanceServersCapabilitiesListOutput, mapDashboardInstanceServersCapabilitiesListQuery, DashboardInstanceServersCapabilitiesListQuery

class MetorialServersCapabilitiesEndpoint(BaseMetorialEndpoint):
  """Get server capabilities information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: DashboardInstanceServersCapabilitiesListQuery = None):
    """
  List server capabilities
  List all server capabilities

  :param query: DashboardInstanceServersCapabilitiesListQuery
  :return: DashboardInstanceServersCapabilitiesListOutput
  """
    request = MetorialRequest(
      path=['server-capabilities'],
      query=mapDashboardInstanceServersCapabilitiesListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServersCapabilitiesListOutput)