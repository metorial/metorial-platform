from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServersVersionsListOutput, DashboardInstanceServersVersionsListOutput, mapDashboardInstanceServersVersionsListQuery, DashboardInstanceServersVersionsListQuery, mapDashboardInstanceServersVersionsGetOutput, DashboardInstanceServersVersionsGetOutput

class MetorialManagementInstanceServersVersionsEndpoint(BaseMetorialEndpoint):
  """Read and write server version information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, serverId: str, query: DashboardInstanceServersVersionsListQuery = None):
    """
  List server versions
  List all server versions

  :param instanceId: str
  :param serverId: str
  :param query: DashboardInstanceServersVersionsListQuery
  :return: DashboardInstanceServersVersionsListOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'servers', serverId, 'versions'],
      query=mapDashboardInstanceServersVersionsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServersVersionsListOutput)

  def get(self, instanceId: str, serverId: str, serverVersionId: str):
    """
  Get server version
  Get the information of a specific server version

  :param instanceId: str
  :param serverId: str
  :param serverVersionId: str
  :return: DashboardInstanceServersVersionsGetOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'servers', serverId, 'versions', serverVersionId]
    )
    return self._get(request).transform(mapDashboardInstanceServersVersionsGetOutput)