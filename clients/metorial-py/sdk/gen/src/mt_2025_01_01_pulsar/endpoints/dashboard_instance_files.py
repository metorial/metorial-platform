from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceFilesListOutput, DashboardInstanceFilesListOutput, mapDashboardInstanceFilesListQuery, DashboardInstanceFilesListQuery, mapDashboardInstanceFilesGetOutput, DashboardInstanceFilesGetOutput, mapDashboardInstanceFilesUpdateOutput, DashboardInstanceFilesUpdateOutput, mapDashboardInstanceFilesUpdateBody, DashboardInstanceFilesUpdateBody, mapDashboardInstanceFilesDeleteOutput, DashboardInstanceFilesDeleteOutput

class MetorialDashboardInstanceFilesEndpoint(BaseMetorialEndpoint):
  """Read and write file information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, query: DashboardInstanceFilesListQuery = None):
    """
  List  files
  List all  files

  :param instanceId: str
  :param query: DashboardInstanceFilesListQuery
  :return: DashboardInstanceFilesListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files'],
      query=mapDashboardInstanceFilesListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapDashboardInstanceFilesListOutput)

  def get(self, instanceId: str, fileId: str):
    """
  Get file
  Get the information of a specific file

  :param instanceId: str
  :param fileId: str
  :return: DashboardInstanceFilesGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId]
    )
    return self._get(request).transform(mapDashboardInstanceFilesGetOutput)

  def update(self, instanceId: str, fileId: str, body: DashboardInstanceFilesUpdateBody):
    """
  Update file
  Update the information of a specific file

  :param instanceId: str
  :param fileId: str
  :param body: DashboardInstanceFilesUpdateBody
  :return: DashboardInstanceFilesUpdateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId],
      body=mapDashboardInstanceFilesUpdateBody.transform_to(body),
    )
    return self._patch(request).transform(mapDashboardInstanceFilesUpdateOutput)

  def delete(self, instanceId: str, fileId: str):
    """
  Delete file
  Delete a specific file

  :param instanceId: str
  :param fileId: str
  :return: DashboardInstanceFilesDeleteOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId]
    )
    return self._delete(request).transform(mapDashboardInstanceFilesDeleteOutput)