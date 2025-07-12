from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardOrganizationsJoinGetOutput, DashboardOrganizationsJoinGetOutput, mapDashboardOrganizationsJoinGetQuery, DashboardOrganizationsJoinGetQuery, mapDashboardOrganizationsJoinAcceptOutput, DashboardOrganizationsJoinAcceptOutput, mapDashboardOrganizationsJoinAcceptBody, DashboardOrganizationsJoinAcceptBody, mapDashboardOrganizationsJoinRejectOutput, DashboardOrganizationsJoinRejectOutput, mapDashboardOrganizationsJoinRejectBody, DashboardOrganizationsJoinRejectBody

class MetorialDashboardOrganizationsJoinEndpoint(BaseMetorialEndpoint):
  """Read and write organization information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def get(self, query: DashboardOrganizationsJoinGetQuery = None):
    """
  Join organization
  Join an organization

  :param query: DashboardOrganizationsJoinGetQuery
  :return: DashboardOrganizationsJoinGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organization-join', 'find'],
      query=mapDashboardOrganizationsJoinGetQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardOrganizationsJoinGetOutput)

  def accept(self, body: DashboardOrganizationsJoinAcceptBody):
    """
  Join organization
  Join an organization

  :param body: DashboardOrganizationsJoinAcceptBody
  :return: DashboardOrganizationsJoinAcceptOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organization-join', 'accept'],
      body=mapDashboardOrganizationsJoinAcceptBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsJoinAcceptOutput)

  def reject(self, body: DashboardOrganizationsJoinRejectBody):
    """
  Reject organization invite
  Reject an organization invite

  :param body: DashboardOrganizationsJoinRejectBody
  :return: DashboardOrganizationsJoinRejectOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organization-join', 'reject'],
      body=mapDashboardOrganizationsJoinRejectBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsJoinRejectOutput)