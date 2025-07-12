from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardOrganizationsProjectsListOutput, DashboardOrganizationsProjectsListOutput, mapDashboardOrganizationsProjectsListQuery, DashboardOrganizationsProjectsListQuery, mapDashboardOrganizationsProjectsGetOutput, DashboardOrganizationsProjectsGetOutput, mapDashboardOrganizationsProjectsCreateOutput, DashboardOrganizationsProjectsCreateOutput, mapDashboardOrganizationsProjectsCreateBody, DashboardOrganizationsProjectsCreateBody, mapDashboardOrganizationsProjectsDeleteOutput, DashboardOrganizationsProjectsDeleteOutput, mapDashboardOrganizationsProjectsUpdateOutput, DashboardOrganizationsProjectsUpdateOutput, mapDashboardOrganizationsProjectsUpdateBody, DashboardOrganizationsProjectsUpdateBody

class MetorialDashboardOrganizationsProjectsEndpoint(BaseMetorialEndpoint):
  """Read and write project information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, organizationId: str, query: DashboardOrganizationsProjectsListQuery = None):
    """
  List organization projects
  List all organization projects

  :param organizationId: str
  :param query: DashboardOrganizationsProjectsListQuery
  :return: DashboardOrganizationsProjectsListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organizations', organizationId, 'projects'],
      query=mapDashboardOrganizationsProjectsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardOrganizationsProjectsListOutput)

  def get(self, organizationId: str, projectId: str):
    """
  Get organization project
  Get the information of a specific organization project

  :param organizationId: str
  :param projectId: str
  :return: DashboardOrganizationsProjectsGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organizations', organizationId, 'projects', projectId]
    )
    return self._get(request).transform(mapDashboardOrganizationsProjectsGetOutput)

  def create(self, organizationId: str, body: DashboardOrganizationsProjectsCreateBody):
    """
  Create organization project
  Create a new organization project

  :param organizationId: str
  :param body: DashboardOrganizationsProjectsCreateBody
  :return: DashboardOrganizationsProjectsCreateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organizations', organizationId, 'projects'],
      body=mapDashboardOrganizationsProjectsCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsProjectsCreateOutput)

  def delete(self, organizationId: str, projectId: str):
    """
  Delete organization project
  Remove an organization project

  :param organizationId: str
  :param projectId: str
  :return: DashboardOrganizationsProjectsDeleteOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organizations', organizationId, 'projects', projectId]
    )
    return self._delete(request).transform(mapDashboardOrganizationsProjectsDeleteOutput)

  def update(self, organizationId: str, projectId: str, body: DashboardOrganizationsProjectsUpdateBody):
    """
  Update organization project
  Update the role of an organization project

  :param organizationId: str
  :param projectId: str
  :param body: DashboardOrganizationsProjectsUpdateBody
  :return: DashboardOrganizationsProjectsUpdateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'organizations', organizationId, 'projects', projectId],
      body=mapDashboardOrganizationsProjectsUpdateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsProjectsUpdateOutput)