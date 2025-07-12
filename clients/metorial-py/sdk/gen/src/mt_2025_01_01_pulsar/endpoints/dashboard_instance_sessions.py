from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceSessionsListOutput, DashboardInstanceSessionsListOutput, mapDashboardInstanceSessionsListQuery, DashboardInstanceSessionsListQuery, mapDashboardInstanceSessionsGetOutput, DashboardInstanceSessionsGetOutput, mapDashboardInstanceSessionsCreateOutput, DashboardInstanceSessionsCreateOutput, mapDashboardInstanceSessionsCreateBody, DashboardInstanceSessionsCreateBody, mapDashboardInstanceSessionsDeleteOutput, DashboardInstanceSessionsDeleteOutput

class MetorialDashboardInstanceSessionsEndpoint(BaseMetorialEndpoint):
  """Read and write session information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, query: DashboardInstanceSessionsListQuery = None):
    """
  List server deployments
  List all server deployments

  :param instanceId: str
  :param query: DashboardInstanceSessionsListQuery
  :return: DashboardInstanceSessionsListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions'],
      query=mapDashboardInstanceSessionsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceSessionsListOutput)

  def get(self, instanceId: str, sessionId: str):
    """
  Get session
  Get the information of a specific session

  :param instanceId: str
  :param sessionId: str
  :return: DashboardInstanceSessionsGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions', sessionId]
    )
    return self._get(request).transform(mapDashboardInstanceSessionsGetOutput)

  def create(self, instanceId: str, body: DashboardInstanceSessionsCreateBody):
    """
  Create session
  Create a new session

  :param instanceId: str
  :param body: DashboardInstanceSessionsCreateBody
  :return: DashboardInstanceSessionsCreateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions'],
      body=mapDashboardInstanceSessionsCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardInstanceSessionsCreateOutput)

  def delete(self, instanceId: str, sessionId: str):
    """
  Delete session
  Delete a session

  :param instanceId: str
  :param sessionId: str
  :return: DashboardInstanceSessionsDeleteOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions', sessionId]
    )
    return self._delete(request).transform(mapDashboardInstanceSessionsDeleteOutput)