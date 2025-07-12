from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServersImplementationsListOutput, DashboardInstanceServersImplementationsListOutput, mapDashboardInstanceServersImplementationsListQuery, DashboardInstanceServersImplementationsListQuery, mapDashboardInstanceServersImplementationsGetOutput, DashboardInstanceServersImplementationsGetOutput, mapDashboardInstanceServersImplementationsCreateOutput, DashboardInstanceServersImplementationsCreateOutput, mapDashboardInstanceServersImplementationsCreateBody, DashboardInstanceServersImplementationsCreateBody, mapDashboardInstanceServersImplementationsUpdateOutput, DashboardInstanceServersImplementationsUpdateOutput, mapDashboardInstanceServersImplementationsUpdateBody, DashboardInstanceServersImplementationsUpdateBody, mapDashboardInstanceServersImplementationsDeleteOutput, DashboardInstanceServersImplementationsDeleteOutput

class MetorialDashboardInstanceServersImplementationsEndpoint(BaseMetorialEndpoint):
  """Read and write server instance information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, query: DashboardInstanceServersImplementationsListQuery = None):
    """
  List server instances
  List all server instances

  :param instanceId: str
  :param query: DashboardInstanceServersImplementationsListQuery
  :return: DashboardInstanceServersImplementationsListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-implementations'],
      query=mapDashboardInstanceServersImplementationsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServersImplementationsListOutput)

  def get(self, instanceId: str, serverImplementationId: str):
    """
  Get server instance
  Get the information of a specific server instance

  :param instanceId: str
  :param serverImplementationId: str
  :return: DashboardInstanceServersImplementationsGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-implementations', serverImplementationId]
    )
    return self._get(request).transform(mapDashboardInstanceServersImplementationsGetOutput)

  def create(self, instanceId: str, body: DashboardInstanceServersImplementationsCreateBody):
    """
  Create server instance
  Create a new server instance

  :param instanceId: str
  :param body: DashboardInstanceServersImplementationsCreateBody
  :return: DashboardInstanceServersImplementationsCreateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-implementations'],
      body=mapDashboardInstanceServersImplementationsCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardInstanceServersImplementationsCreateOutput)

  def update(self, instanceId: str, serverImplementationId: str, body: DashboardInstanceServersImplementationsUpdateBody):
    """
  Update server instance
  Update a server instance

  :param instanceId: str
  :param serverImplementationId: str
  :param body: DashboardInstanceServersImplementationsUpdateBody
  :return: DashboardInstanceServersImplementationsUpdateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-implementations', serverImplementationId],
      body=mapDashboardInstanceServersImplementationsUpdateBody.transform_to(body),
    )
    return self._patch(request).transform(mapDashboardInstanceServersImplementationsUpdateOutput)

  def delete(self, instanceId: str, serverImplementationId: str):
    """
  Delete server instance
  Delete a server instance

  :param instanceId: str
  :param serverImplementationId: str
  :return: DashboardInstanceServersImplementationsDeleteOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-implementations', serverImplementationId]
    )
    return self._delete(request).transform(mapDashboardInstanceServersImplementationsDeleteOutput)