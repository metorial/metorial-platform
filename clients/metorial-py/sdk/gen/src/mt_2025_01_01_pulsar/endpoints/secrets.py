from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceSecretsListOutput, DashboardInstanceSecretsListOutput, mapDashboardInstanceSecretsListQuery, DashboardInstanceSecretsListQuery, mapDashboardInstanceSecretsGetOutput, DashboardInstanceSecretsGetOutput

class MetorialSecretsEndpoint(BaseMetorialEndpoint):
  """Read and write secret information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: DashboardInstanceSecretsListQuery = None):
    """
  List secrets
  List all  secrets

  :param query: DashboardInstanceSecretsListQuery
  :return: DashboardInstanceSecretsListOutput
  """
    request = MetorialRequest(
      path=['secrets'],
      query=mapDashboardInstanceSecretsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceSecretsListOutput)

  def get(self, secretId: str):
    """
  Get secret
  Get the information of a specific secret

  :param secretId: str
  :return: DashboardInstanceSecretsGetOutput
  """
    request = MetorialRequest(
      path=['secrets', secretId]
    )
    return self._get(request).transform(mapDashboardInstanceSecretsGetOutput)