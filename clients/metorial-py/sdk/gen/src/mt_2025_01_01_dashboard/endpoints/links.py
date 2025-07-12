from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceLinksListOutput, DashboardInstanceLinksListOutput, mapDashboardInstanceLinksGetOutput, DashboardInstanceLinksGetOutput, mapDashboardInstanceLinksCreateOutput, DashboardInstanceLinksCreateOutput, mapDashboardInstanceLinksCreateBody, DashboardInstanceLinksCreateBody, mapDashboardInstanceLinksUpdateOutput, DashboardInstanceLinksUpdateOutput, mapDashboardInstanceLinksUpdateBody, DashboardInstanceLinksUpdateBody, mapDashboardInstanceLinksDeleteOutput, DashboardInstanceLinksDeleteOutput

class MetorialLinksEndpoint(BaseMetorialEndpoint):
  """Read and write file link information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, fileId: str):
    """
  List file links
  List all file links

  :param fileId: str
  :return: DashboardInstanceLinksListOutput
  """
    request = MetorialRequest(
      path=['files', fileId, 'links']
    )
    return self._get(request).transform(mapDashboardInstanceLinksListOutput)

  def get(self, fileId: str, linkId: str):
    """
  Get file link
  Get the information of a specific file link

  :param fileId: str
  :param linkId: str
  :return: DashboardInstanceLinksGetOutput
  """
    request = MetorialRequest(
      path=['files', fileId, 'links', linkId]
    )
    return self._get(request).transform(mapDashboardInstanceLinksGetOutput)

  def create(self, fileId: str, body: DashboardInstanceLinksCreateBody):
    """
  Create file link
  Create a new file link

  :param fileId: str
  :param body: DashboardInstanceLinksCreateBody
  :return: DashboardInstanceLinksCreateOutput
  """
    request = MetorialRequest(
      path=['files', fileId, 'links'],
      body=mapDashboardInstanceLinksCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardInstanceLinksCreateOutput)

  def update(self, fileId: str, linkId: str, body: DashboardInstanceLinksUpdateBody):
    """
  Update file link
  Update the information of a specific file link

  :param fileId: str
  :param linkId: str
  :param body: DashboardInstanceLinksUpdateBody
  :return: DashboardInstanceLinksUpdateOutput
  """
    request = MetorialRequest(
      path=['files', fileId, 'links', linkId],
      body=mapDashboardInstanceLinksUpdateBody.transform_to(body),
    )
    return self._patch(request).transform(mapDashboardInstanceLinksUpdateOutput)

  def delete(self, fileId: str, linkId: str):
    """
  Delete file link
  Delete a specific file link

  :param fileId: str
  :param linkId: str
  :return: DashboardInstanceLinksDeleteOutput
  """
    request = MetorialRequest(
      path=['files', fileId, 'links', linkId]
    )
    return self._delete(request).transform(mapDashboardInstanceLinksDeleteOutput)