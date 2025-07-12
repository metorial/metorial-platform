from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServerRunErrorGroupsListOutput, DashboardInstanceServerRunErrorGroupsListOutput, mapDashboardInstanceServerRunErrorGroupsListQuery, DashboardInstanceServerRunErrorGroupsListQuery, mapDashboardInstanceServerRunErrorGroupsGetOutput, DashboardInstanceServerRunErrorGroupsGetOutput

class MetorialManagementInstanceServerRunErrorGroupsEndpoint(BaseMetorialEndpoint):
  """Read and write server run error group information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, query: DashboardInstanceServerRunErrorGroupsListQuery = None):
    """
  List server deployments
  List all server deployments

  :param instanceId: str
  :param query: DashboardInstanceServerRunErrorGroupsListQuery
  :return: DashboardInstanceServerRunErrorGroupsListOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'server-run-error-groups'],
      query=mapDashboardInstanceServerRunErrorGroupsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServerRunErrorGroupsListOutput)

  def get(self, instanceId: str, serverRunErrorGroupId: str):
    """
  Get server run error group
  Get the information of a specific server run error group

  :param instanceId: str
  :param serverRunErrorGroupId: str
  :return: DashboardInstanceServerRunErrorGroupsGetOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'server-run-error-groups', serverRunErrorGroupId]
    )
    return self._get(request).transform(mapDashboardInstanceServerRunErrorGroupsGetOutput)