from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceSessionsEventsListOutput, DashboardInstanceSessionsEventsListOutput, mapDashboardInstanceSessionsEventsListQuery, DashboardInstanceSessionsEventsListQuery, mapDashboardInstanceSessionsEventsGetOutput, DashboardInstanceSessionsEventsGetOutput

class MetorialDashboardInstanceSessionsEventsEndpoint(BaseMetorialEndpoint):
  """Read and write session event information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, sessionId: str, query: DashboardInstanceSessionsEventsListQuery = None):
    """
  List session events
  List all session events

  :param instanceId: str
  :param sessionId: str
  :param query: DashboardInstanceSessionsEventsListQuery
  :return: DashboardInstanceSessionsEventsListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions', sessionId, 'events'],
      query=mapDashboardInstanceSessionsEventsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceSessionsEventsListOutput)

  def get(self, instanceId: str, sessionId: str, sessionEventId: str):
    """
  Get session event
  Get the information of a specific session event

  :param instanceId: str
  :param sessionId: str
  :param sessionEventId: str
  :return: DashboardInstanceSessionsEventsGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'sessions', sessionId, 'events', sessionEventId]
    )
    return self._get(request).transform(mapDashboardInstanceSessionsEventsGetOutput)