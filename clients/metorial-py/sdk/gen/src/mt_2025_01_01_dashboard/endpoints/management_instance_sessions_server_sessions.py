from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceSessionsServerSessionsListOutput, DashboardInstanceSessionsServerSessionsListOutput, mapDashboardInstanceSessionsServerSessionsListQuery, DashboardInstanceSessionsServerSessionsListQuery, mapDashboardInstanceSessionsServerSessionsGetOutput, DashboardInstanceSessionsServerSessionsGetOutput

class MetorialManagementInstanceSessionsServerSessionsEndpoint(BaseMetorialEndpoint):
  """Read and write server session information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, sessionId: str, query: DashboardInstanceSessionsServerSessionsListQuery = None):
    """
  List server sessions
  List all server sessions

  :param instanceId: str
  :param sessionId: str
  :param query: DashboardInstanceSessionsServerSessionsListQuery
  :return: DashboardInstanceSessionsServerSessionsListOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'sessions', sessionId, 'server-sessions'],
      query=mapDashboardInstanceSessionsServerSessionsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceSessionsServerSessionsListOutput)

  def get(self, instanceId: str, sessionId: str, serverSessionId: str):
    """
  Get server session
  Get the information of a specific server session

  :param instanceId: str
  :param sessionId: str
  :param serverSessionId: str
  :return: DashboardInstanceSessionsServerSessionsGetOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'sessions', sessionId, 'server-sessions', serverSessionId]
    )
    return self._get(request).transform(mapDashboardInstanceSessionsServerSessionsGetOutput)