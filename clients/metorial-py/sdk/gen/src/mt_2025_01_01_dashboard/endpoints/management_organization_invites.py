from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardOrganizationsInvitesListOutput, DashboardOrganizationsInvitesListOutput, mapDashboardOrganizationsInvitesListQuery, DashboardOrganizationsInvitesListQuery, mapDashboardOrganizationsInvitesGetOutput, DashboardOrganizationsInvitesGetOutput, mapDashboardOrganizationsInvitesCreateOutput, DashboardOrganizationsInvitesCreateOutput, mapDashboardOrganizationsInvitesCreateBody, DashboardOrganizationsInvitesCreateBody, mapDashboardOrganizationsInvitesEnsureLinkOutput, DashboardOrganizationsInvitesEnsureLinkOutput, mapDashboardOrganizationsInvitesDeleteOutput, DashboardOrganizationsInvitesDeleteOutput, mapDashboardOrganizationsInvitesUpdateOutput, DashboardOrganizationsInvitesUpdateOutput, mapDashboardOrganizationsInvitesUpdateBody, DashboardOrganizationsInvitesUpdateBody

class MetorialManagementOrganizationInvitesEndpoint(BaseMetorialEndpoint):
  """Read and write organization invite information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: DashboardOrganizationsInvitesListQuery = None):
    """
  List organization invites
  List all organization invites

  :param query: DashboardOrganizationsInvitesListQuery
  :return: DashboardOrganizationsInvitesListOutput
  """
    request = MetorialRequest(
      path=['organization', 'invites'],
      query=mapDashboardOrganizationsInvitesListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardOrganizationsInvitesListOutput)

  def get(self, inviteId: str):
    """
  Get organization invite
  Get the information of a specific organization invite

  :param inviteId: str
  :return: DashboardOrganizationsInvitesGetOutput
  """
    request = MetorialRequest(
      path=['organization', 'invites', inviteId]
    )
    return self._get(request).transform(mapDashboardOrganizationsInvitesGetOutput)

  def create(self, body: DashboardOrganizationsInvitesCreateBody):
    """
  Create organization invite
  Create a new organization invite

  :param body: DashboardOrganizationsInvitesCreateBody
  :return: DashboardOrganizationsInvitesCreateOutput
  """
    request = MetorialRequest(
      path=['organization', 'invites'],
      body=mapDashboardOrganizationsInvitesCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsInvitesCreateOutput)

  def ensure_link(self):
    """
  Ensure organization invite link
  Ensure the invite link for the organization


  :return: DashboardOrganizationsInvitesEnsureLinkOutput
  """
    request = MetorialRequest(
      path=['organization', 'invites', 'ensure']
    )
    return self._post(request).transform(mapDashboardOrganizationsInvitesEnsureLinkOutput)

  def delete(self, inviteId: str):
    """
  Delete organization invite
  Remove an organization invite

  :param inviteId: str
  :return: DashboardOrganizationsInvitesDeleteOutput
  """
    request = MetorialRequest(
      path=['organization', 'invites', inviteId]
    )
    return self._delete(request).transform(mapDashboardOrganizationsInvitesDeleteOutput)

  def update(self, inviteId: str, body: DashboardOrganizationsInvitesUpdateBody):
    """
  Update organization invite
  Update the role of an organization invite

  :param inviteId: str
  :param body: DashboardOrganizationsInvitesUpdateBody
  :return: DashboardOrganizationsInvitesUpdateOutput
  """
    request = MetorialRequest(
      path=['organization', 'invites', inviteId],
      body=mapDashboardOrganizationsInvitesUpdateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsInvitesUpdateOutput)