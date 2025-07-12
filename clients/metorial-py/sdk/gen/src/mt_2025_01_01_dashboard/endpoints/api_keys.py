from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapApiKeysListOutput, ApiKeysListOutput, mapApiKeysListQuery, ApiKeysListQuery, mapApiKeysGetOutput, ApiKeysGetOutput, mapApiKeysCreateOutput, ApiKeysCreateOutput, mapApiKeysCreateBody, ApiKeysCreateBody, mapApiKeysUpdateOutput, ApiKeysUpdateOutput, mapApiKeysUpdateBody, ApiKeysUpdateBody, mapApiKeysRevokeOutput, ApiKeysRevokeOutput, mapApiKeysRotateOutput, ApiKeysRotateOutput, mapApiKeysRotateBody, ApiKeysRotateBody, mapApiKeysRevealOutput, ApiKeysRevealOutput

class MetorialApiKeysEndpoint(BaseMetorialEndpoint):
  """Read and write API key information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: ApiKeysListQuery = None):
    """
  Get user
  Get the current user information

  :param query: ApiKeysListQuery
  :return: ApiKeysListOutput
  """
    request = MetorialRequest(
      path=['api-keys'],
      query=mapApiKeysListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapApiKeysListOutput)

  def get(self, apiKeyId: str):
    """
  Get API key
  Get the information of a specific API key

  :param apiKeyId: str
  :return: ApiKeysGetOutput
  """
    request = MetorialRequest(
      path=['api-keys', apiKeyId]
    )
    return self._get(request).transform(mapApiKeysGetOutput)

  def create(self, body: ApiKeysCreateBody):
    """
  Create API key
  Create a new API key

  :param body: ApiKeysCreateBody
  :return: ApiKeysCreateOutput
  """
    request = MetorialRequest(
      path=['api-keys'],
      body=mapApiKeysCreateBody.transform_to(body),
    )
    return self._post(request).transform(mapApiKeysCreateOutput)

  def update(self, apiKeyId: str, body: ApiKeysUpdateBody):
    """
  Update API key
  Update the information of a specific API key

  :param apiKeyId: str
  :param body: ApiKeysUpdateBody
  :return: ApiKeysUpdateOutput
  """
    request = MetorialRequest(
      path=['api-keys', apiKeyId],
      body=mapApiKeysUpdateBody.transform_to(body),
    )
    return self._post(request).transform(mapApiKeysUpdateOutput)

  def revoke(self, apiKeyId: str):
    """
  Revoke API key
  Revoke a specific API key

  :param apiKeyId: str
  :return: ApiKeysRevokeOutput
  """
    request = MetorialRequest(
      path=['api-keys', apiKeyId]
    )
    return self._delete(request).transform(mapApiKeysRevokeOutput)

  def rotate(self, apiKeyId: str, body: ApiKeysRotateBody):
    """
  Rotate API key
  Rotate a specific API key

  :param apiKeyId: str
  :param body: ApiKeysRotateBody
  :return: ApiKeysRotateOutput
  """
    request = MetorialRequest(
      path=['api-keys', apiKeyId, 'rotate'],
      body=mapApiKeysRotateBody.transform_to(body),
    )
    return self._post(request).transform(mapApiKeysRotateOutput)

  def reveal(self, apiKeyId: str):
    """
  Reveal API key
  Reveal a specific API key

  :param apiKeyId: str
  :return: ApiKeysRevealOutput
  """
    request = MetorialRequest(
      path=['api-keys', apiKeyId, 'reveal']
    )
    return self._post(request).transform(mapApiKeysRevealOutput)