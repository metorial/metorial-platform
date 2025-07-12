from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapManagementOrganizationGetOutput, ManagementOrganizationGetOutput, mapManagementOrganizationUpdateOutput, ManagementOrganizationUpdateOutput, mapManagementOrganizationUpdateBody, ManagementOrganizationUpdateBody

class MetorialManagementOrganizationEndpoint(BaseMetorialEndpoint):
  """Read and write organization information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def get(self):
    """
  Get organization
  Get the current organization information


  :return: ManagementOrganizationGetOutput
  """
    request = MetorialRequest(
      path=['organization']
    )
    return self._get(request).transform(mapManagementOrganizationGetOutput)

  def update(self, body: ManagementOrganizationUpdateBody):
    """
  Update organization
  Update the current organization information

  :param body: ManagementOrganizationUpdateBody
  :return: ManagementOrganizationUpdateOutput
  """
    request = MetorialRequest(
      path=['organization'],
      body=mapManagementOrganizationUpdateBody.transform_to(body),
    )
    return self._patch(request).transform(mapManagementOrganizationUpdateOutput)