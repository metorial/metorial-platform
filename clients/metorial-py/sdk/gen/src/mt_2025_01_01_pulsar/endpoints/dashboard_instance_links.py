from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapDashboardInstanceLinksListOutput, DashboardInstanceLinksListOutput, mapDashboardInstanceLinksGetOutput, DashboardInstanceLinksGetOutput, mapDashboardInstanceLinksCreateOutput, DashboardInstanceLinksCreateOutput, mapDashboardInstanceLinksCreateBody, DashboardInstanceLinksCreateBody, mapDashboardInstanceLinksUpdateOutput, DashboardInstanceLinksUpdateOutput, mapDashboardInstanceLinksUpdateBody, DashboardInstanceLinksUpdateBody, mapDashboardInstanceLinksDeleteOutput, DashboardInstanceLinksDeleteOutput

class MetorialDashboardInstanceLinksEndpoint(BaseMetorialEndpoint):
  """Read and write file link information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, instanceId: str, fileId: str):
    """
  List file links
  List all file links

  :param instanceId: str
  :param fileId: str
  :return: DashboardInstanceLinksListOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId, 'links']
    )
    return self._get(request).transform(mapDashboardInstanceLinksListOutput)

  def get(self, instanceId: str, fileId: str, linkId: str):
    """
  Get file link
  Get the information of a specific file link

  :param instanceId: str
  :param fileId: str
  :param linkId: str
  :return: DashboardInstanceLinksGetOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId, 'links', linkId]
    )
    return self._get(request).transform(mapDashboardInstanceLinksGetOutput)

  def create(self, instanceId: str, fileId: str, body: DashboardInstanceLinksCreateBody):
    """
  Create file link
  Create a new file link

  :param instanceId: str
  :param fileId: str
  :param body: DashboardInstanceLinksCreateBody
  :return: DashboardInstanceLinksCreateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId, 'links'],
      body=mapDashboardInstanceLinksCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapDashboardInstanceLinksCreateOutput)

  def update(self, instanceId: str, fileId: str, linkId: str, body: DashboardInstanceLinksUpdateBody):
    """
  Update file link
  Update the information of a specific file link

  :param instanceId: str
  :param fileId: str
  :param linkId: str
  :param body: DashboardInstanceLinksUpdateBody
  :return: DashboardInstanceLinksUpdateOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId, 'links', linkId],
      body=mapDashboardInstanceLinksUpdateBody.transform_to(body),
    )
    return self._patch(request).transform(mapDashboardInstanceLinksUpdateOutput)

  def delete(self, instanceId: str, fileId: str, linkId: str):
    """
  Delete file link
  Delete a specific file link

  :param instanceId: str
  :param fileId: str
  :param linkId: str
  :return: DashboardInstanceLinksDeleteOutput
  """
    request = MetorialRequest(
      path=['dashboard', 'instances', instanceId, 'files', fileId, 'links', linkId]
    )
    return self._delete(request).transform(mapDashboardInstanceLinksDeleteOutput)