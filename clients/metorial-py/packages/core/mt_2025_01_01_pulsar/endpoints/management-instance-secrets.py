from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceSecretsListOutput, DashboardInstanceSecretsListOutput, mapDashboardInstanceSecretsListQuery, DashboardInstanceSecretsListQuery, mapDashboardInstanceSecretsGetOutput, DashboardInstanceSecretsGetOutput

class MetorialManagementInstanceSecretsEndpoint(BaseMetorialEndpoint):
  """Read and write secret information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, query: DashboardInstanceSecretsListQuery = None):
    """
  List secrets
  List all  secrets

  :param instanceId: str
  :param query: DashboardInstanceSecretsListQuery
  :return: DashboardInstanceSecretsListOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'secrets'],
      query=mapDashboardInstanceSecretsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceSecretsListOutput)

  def get(self, instanceId: str, secretId: str):
    """
  Get secret
  Get the information of a specific secret

  :param instanceId: str
  :param secretId: str
  :return: DashboardInstanceSecretsGetOutput
  """
    request = MetorialRequest(
      path=['instances', instanceId, 'secrets', secretId]
    )
    return self._get(request).transform(mapDashboardInstanceSecretsGetOutput)