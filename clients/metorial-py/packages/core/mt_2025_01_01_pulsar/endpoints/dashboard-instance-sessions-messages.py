from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceSessionsMessagesListOutput, DashboardInstanceSessionsMessagesListOutput, mapDashboardInstanceSessionsMessagesListQuery, DashboardInstanceSessionsMessagesListQuery, mapDashboardInstanceSessionsMessagesGetOutput, DashboardInstanceSessionsMessagesGetOutput

class MetorialDashboardInstanceSessionsMessagesEndpoint(BaseMetorialEndpoint):
  """Read and write session message information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, sessionId: str, query: DashboardInstanceSessionsMessagesListQuery = None):
    """
  List session messages
  List all session messages

  :param instanceId: str
  :param sessionId: str
  :param query: DashboardInstanceSessionsMessagesListQuery
  :return: DashboardInstanceSessionsMessagesListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions', sessionId, 'messages'],
      query=mapDashboardInstanceSessionsMessagesListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceSessionsMessagesListOutput)

  def get(self, instanceId: str, sessionId: str, sessionMessageId: str):
    """
  Get session message
  Get the information of a specific session message

  :param instanceId: str
  :param sessionId: str
  :param sessionMessageId: str
  :return: DashboardInstanceSessionsMessagesGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions', sessionId, 'messages', sessionMessageId]
    )
    return self._get(request).transform(mapDashboardInstanceSessionsMessagesGetOutput)