from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServerRunsListOutput, DashboardInstanceServerRunsListOutput, mapDashboardInstanceServerRunsListQuery, DashboardInstanceServerRunsListQuery, mapDashboardInstanceServerRunsGetOutput, DashboardInstanceServerRunsGetOutput

class MetorialServerRunsEndpoint(BaseMetorialEndpoint):
  """Read and write server run information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: DashboardInstanceServerRunsListQuery = None):
    """
  List server deployments
  List all server deployments

  :param query: DashboardInstanceServerRunsListQuery
  :return: DashboardInstanceServerRunsListOutput
  """
    request = MetorialRequest(
      path=['server-runs'],
      query=mapDashboardInstanceServerRunsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServerRunsListOutput)

  def get(self, serverRunId: str):
    """
  Get server run
  Get the information of a specific server run

  :param serverRunId: str
  :return: DashboardInstanceServerRunsGetOutput
  """
    request = MetorialRequest(
      path=['server-runs', serverRunId]
    )
    return self._get(request).transform(mapDashboardInstanceServerRunsGetOutput)