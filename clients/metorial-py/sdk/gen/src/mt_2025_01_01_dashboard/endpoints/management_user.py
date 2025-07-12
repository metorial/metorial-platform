from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapManagementUserGetOutput, ManagementUserGetOutput, mapManagementUserUpdateOutput, ManagementUserUpdateOutput, mapManagementUserUpdateBody, ManagementUserUpdateBody, mapManagementUserDeleteOutput, ManagementUserDeleteOutput, mapManagementUserDeleteBody, ManagementUserDeleteBody

class MetorialManagementUserEndpoint(BaseMetorialEndpoint):
  """Read and write user information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def get(self):
    """
  Get user
  Get the current user information


  :return: ManagementUserGetOutput
  """
    request = MetorialRequest(
      path=['user']
    )
    return self._get(request).transform(mapManagementUserGetOutput)

  def update(self, body: ManagementUserUpdateBody):
    """
  Update user
  Update the current user information

  :param body: ManagementUserUpdateBody
  :return: ManagementUserUpdateOutput
  """
    request = MetorialRequest(
      path=['user'],
      body=mapManagementUserUpdateBody.transform_to(body),
    )
    return self._post(request).transform(mapManagementUserUpdateOutput)

  def delete(self, body: ManagementUserDeleteBody):
    """
  Update user
  Update the current user information

  :param body: ManagementUserDeleteBody
  :return: ManagementUserDeleteOutput
  """
    request = MetorialRequest(
      path=['user'],
      body=mapManagementUserDeleteBody.transform_to(body),
    )
    return self._post(request).transform(mapManagementUserDeleteOutput)