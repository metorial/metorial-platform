from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServerRunErrorsListOutput, DashboardInstanceServerRunErrorsListOutput, mapDashboardInstanceServerRunErrorsListQuery, DashboardInstanceServerRunErrorsListQuery, mapDashboardInstanceServerRunErrorsGetOutput, DashboardInstanceServerRunErrorsGetOutput

class MetorialManagementInstanceServerRunErrorsEndpoint(BaseMetorialEndpoint):
  """Read and write server run error information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, query: DashboardInstanceServerRunErrorsListQuery = None):
    """
  List server deployments
  List all server deployments

  :param instanceId: str
  :param query: DashboardInstanceServerRunErrorsListQuery
  :return: DashboardInstanceServerRunErrorsListOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'server-run-errors'],
      query=mapDashboardInstanceServerRunErrorsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServerRunErrorsListOutput)

  def get(self, instanceId: str, serverRunErrorId: str):
    """
  Get server run error
  Get the information of a specific server run error

  :param instanceId: str
  :param serverRunErrorId: str
  :return: DashboardInstanceServerRunErrorsGetOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'server-run-errors', serverRunErrorId]
    )
    return self._get(request).transform(mapDashboardInstanceServerRunErrorsGetOutput)