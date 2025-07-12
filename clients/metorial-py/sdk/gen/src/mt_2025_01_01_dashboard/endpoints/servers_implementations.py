from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServersImplementationsListOutput, DashboardInstanceServersImplementationsListOutput, mapDashboardInstanceServersImplementationsListQuery, DashboardInstanceServersImplementationsListQuery, mapDashboardInstanceServersImplementationsGetOutput, DashboardInstanceServersImplementationsGetOutput, mapDashboardInstanceServersImplementationsCreateOutput, DashboardInstanceServersImplementationsCreateOutput, mapDashboardInstanceServersImplementationsCreateBody, DashboardInstanceServersImplementationsCreateBody, mapDashboardInstanceServersImplementationsUpdateOutput, DashboardInstanceServersImplementationsUpdateOutput, mapDashboardInstanceServersImplementationsUpdateBody, DashboardInstanceServersImplementationsUpdateBody, mapDashboardInstanceServersImplementationsDeleteOutput, DashboardInstanceServersImplementationsDeleteOutput

class MetorialServersImplementationsEndpoint(BaseMetorialEndpoint):
  """Read and write server instance information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: DashboardInstanceServersImplementationsListQuery = None):
    """
  List server instances
  List all server instances

  :param query: DashboardInstanceServersImplementationsListQuery
  :return: DashboardInstanceServersImplementationsListOutput
  """
    request = MetorialRequest(
      path=['server-implementations'],
      query=mapDashboardInstanceServersImplementationsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServersImplementationsListOutput)

  def get(self, serverImplementationId: str):
    """
  Get server instance
  Get the information of a specific server instance

  :param serverImplementationId: str
  :return: DashboardInstanceServersImplementationsGetOutput
  """
    request = MetorialRequest(
      path=['server-implementations', serverImplementationId]
    )
    return self._get(request).transform(mapDashboardInstanceServersImplementationsGetOutput)

  def create(self, body: DashboardInstanceServersImplementationsCreateBody):
    """
  Create server instance
  Create a new server instance

  :param body: DashboardInstanceServersImplementationsCreateBody
  :return: DashboardInstanceServersImplementationsCreateOutput
  """
    request = MetorialRequest(
      path=['server-implementations'],
      body=mapDashboardInstanceServersImplementationsCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardInstanceServersImplementationsCreateOutput)

  def update(self, serverImplementationId: str, body: DashboardInstanceServersImplementationsUpdateBody):
    """
  Update server instance
  Update a server instance

  :param serverImplementationId: str
  :param body: DashboardInstanceServersImplementationsUpdateBody
  :return: DashboardInstanceServersImplementationsUpdateOutput
  """
    request = MetorialRequest(
      path=['server-implementations', serverImplementationId],
      body=mapDashboardInstanceServersImplementationsUpdateBody.transform_to(body),
    )
    return self._patch(request).transform(mapDashboardInstanceServersImplementationsUpdateOutput)

  def delete(self, serverImplementationId: str):
    """
  Delete server instance
  Delete a server instance

  :param serverImplementationId: str
  :return: DashboardInstanceServersImplementationsDeleteOutput
  """
    request = MetorialRequest(
      path=['server-implementations', serverImplementationId]
    )
    return self._delete(request).transform(mapDashboardInstanceServersImplementationsDeleteOutput)