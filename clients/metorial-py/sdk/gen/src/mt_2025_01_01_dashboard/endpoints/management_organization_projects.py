from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardOrganizationsProjectsListOutput, DashboardOrganizationsProjectsListOutput, mapDashboardOrganizationsProjectsListQuery, DashboardOrganizationsProjectsListQuery, mapDashboardOrganizationsProjectsGetOutput, DashboardOrganizationsProjectsGetOutput, mapDashboardOrganizationsProjectsCreateOutput, DashboardOrganizationsProjectsCreateOutput, mapDashboardOrganizationsProjectsCreateBody, DashboardOrganizationsProjectsCreateBody, mapDashboardOrganizationsProjectsDeleteOutput, DashboardOrganizationsProjectsDeleteOutput, mapDashboardOrganizationsProjectsUpdateOutput, DashboardOrganizationsProjectsUpdateOutput, mapDashboardOrganizationsProjectsUpdateBody, DashboardOrganizationsProjectsUpdateBody

class MetorialManagementOrganizationProjectsEndpoint(BaseMetorialEndpoint):
  """Read and write project information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: DashboardOrganizationsProjectsListQuery = None):
    """
  List organization projects
  List all organization projects

  :param query: DashboardOrganizationsProjectsListQuery
  :return: DashboardOrganizationsProjectsListOutput
  """
    request = MetorialRequest(
      path=['organization', 'projects'],
      query=mapDashboardOrganizationsProjectsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardOrganizationsProjectsListOutput)

  def get(self, projectId: str):
    """
  Get organization project
  Get the information of a specific organization project

  :param projectId: str
  :return: DashboardOrganizationsProjectsGetOutput
  """
    request = MetorialRequest(
      path=['organization', 'projects', projectId]
    )
    return self._get(request).transform(mapDashboardOrganizationsProjectsGetOutput)

  def create(self, body: DashboardOrganizationsProjectsCreateBody):
    """
  Create organization project
  Create a new organization project

  :param body: DashboardOrganizationsProjectsCreateBody
  :return: DashboardOrganizationsProjectsCreateOutput
  """
    request = MetorialRequest(
      path=['organization', 'projects'],
      body=mapDashboardOrganizationsProjectsCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsProjectsCreateOutput)

  def delete(self, projectId: str):
    """
  Delete organization project
  Remove an organization project

  :param projectId: str
  :return: DashboardOrganizationsProjectsDeleteOutput
  """
    request = MetorialRequest(
      path=['organization', 'projects', projectId]
    )
    return self._delete(request).transform(mapDashboardOrganizationsProjectsDeleteOutput)

  def update(self, projectId: str, body: DashboardOrganizationsProjectsUpdateBody):
    """
  Update organization project
  Update the role of an organization project

  :param projectId: str
  :param body: DashboardOrganizationsProjectsUpdateBody
  :return: DashboardOrganizationsProjectsUpdateOutput
  """
    request = MetorialRequest(
      path=['organization', 'projects', projectId],
      body=mapDashboardOrganizationsProjectsUpdateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardOrganizationsProjectsUpdateOutput)