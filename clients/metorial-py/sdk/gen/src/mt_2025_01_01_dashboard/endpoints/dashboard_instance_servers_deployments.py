from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceServersDeploymentsListOutput, DashboardInstanceServersDeploymentsListOutput, mapDashboardInstanceServersDeploymentsListQuery, DashboardInstanceServersDeploymentsListQuery, mapDashboardInstanceServersDeploymentsGetOutput, DashboardInstanceServersDeploymentsGetOutput, mapDashboardInstanceServersDeploymentsCreateOutput, DashboardInstanceServersDeploymentsCreateOutput, mapDashboardInstanceServersDeploymentsCreateBody, DashboardInstanceServersDeploymentsCreateBody, mapDashboardInstanceServersDeploymentsUpdateOutput, DashboardInstanceServersDeploymentsUpdateOutput, mapDashboardInstanceServersDeploymentsUpdateBody, DashboardInstanceServersDeploymentsUpdateBody, mapDashboardInstanceServersDeploymentsDeleteOutput, DashboardInstanceServersDeploymentsDeleteOutput

class MetorialDashboardInstanceServersDeploymentsEndpoint(BaseMetorialEndpoint):
  """Read and write server instance information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, query: DashboardInstanceServersDeploymentsListQuery = None):
    """
  List server deployments
  List all server deployments

  :param instanceId: str
  :param query: DashboardInstanceServersDeploymentsListQuery
  :return: DashboardInstanceServersDeploymentsListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-deployments'],
      query=mapDashboardInstanceServersDeploymentsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceServersDeploymentsListOutput)

  def get(self, instanceId: str, serverDeploymentId: str):
    """
  Get server instance
  Get the information of a specific server instance

  :param instanceId: str
  :param serverDeploymentId: str
  :return: DashboardInstanceServersDeploymentsGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-deployments', serverDeploymentId]
    )
    return self._get(request).transform(mapDashboardInstanceServersDeploymentsGetOutput)

  def create(self, instanceId: str, body: DashboardInstanceServersDeploymentsCreateBody):
    """
  Create server instance
  Create a new server instance

  :param instanceId: str
  :param body: DashboardInstanceServersDeploymentsCreateBody
  :return: DashboardInstanceServersDeploymentsCreateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-deployments'],
      body=mapDashboardInstanceServersDeploymentsCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardInstanceServersDeploymentsCreateOutput)

  def update(self, instanceId: str, serverDeploymentId: str, body: DashboardInstanceServersDeploymentsUpdateBody):
    """
  Update server instance
  Update a server instance

  :param instanceId: str
  :param serverDeploymentId: str
  :param body: DashboardInstanceServersDeploymentsUpdateBody
  :return: DashboardInstanceServersDeploymentsUpdateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-deployments', serverDeploymentId],
      body=mapDashboardInstanceServersDeploymentsUpdateBody.transform_to(body),
    )
    return self._patch(request).transform(mapDashboardInstanceServersDeploymentsUpdateOutput)

  def delete(self, instanceId: str, serverDeploymentId: str):
    """
  Delete server instance
  Delete a server instance

  :param instanceId: str
  :param serverDeploymentId: str
  :return: DashboardInstanceServersDeploymentsDeleteOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'server-deployments', serverDeploymentId]
    )
    return self._delete(request).transform(mapDashboardInstanceServersDeploymentsDeleteOutput)