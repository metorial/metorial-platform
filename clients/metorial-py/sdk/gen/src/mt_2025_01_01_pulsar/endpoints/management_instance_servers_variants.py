from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServersVariantsListOutput, DashboardInstanceServersVariantsListOutput, mapDashboardInstanceServersVariantsListQuery, DashboardInstanceServersVariantsListQuery, mapDashboardInstanceServersVariantsGetOutput, DashboardInstanceServersVariantsGetOutput

class MetorialManagementInstanceServersVariantsEndpoint(BaseMetorialEndpoint):
  """Read and write server variant information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, serverId: str, query: DashboardInstanceServersVariantsListQuery = None):
    """
  List server variants
  List all server variants

  :param instanceId: str
  :param serverId: str
  :param query: DashboardInstanceServersVariantsListQuery
  :return: DashboardInstanceServersVariantsListOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'servers', serverId, 'variants'],
      query=mapDashboardInstanceServersVariantsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServersVariantsListOutput)

  def get(self, instanceId: str, serverId: str, serverVariantId: str):
    """
  Get server variant
  Get the information of a specific server variant

  :param instanceId: str
  :param serverId: str
  :param serverVariantId: str
  :return: DashboardInstanceServersVariantsGetOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'servers', serverId, 'variants', serverVariantId]
    )
    return self._get(request).transform(mapDashboardInstanceServersVariantsGetOutput)