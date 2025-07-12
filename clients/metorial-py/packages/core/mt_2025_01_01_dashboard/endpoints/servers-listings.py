from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapServersListingsListOutput, ServersListingsListOutput, mapServersListingsListQuery, ServersListingsListQuery, mapServersListingsGetOutput, ServersListingsGetOutput

class MetorialServersListingsEndpoint(BaseMetorialEndpoint):
  """Read and write server version information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: ServersListingsListQuery = None):
    """
  List server versions
  List all server versions

  :param query: ServersListingsListQuery
  :return: ServersListingsListOutput
  """
    request = MetorialRequest(
      path=['server-listings'],
      query=mapServersListingsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapServersListingsListOutput)

  def get(self, serverListingId: str):
    """
  Get server version
  Get the information of a specific server version

  :param serverListingId: str
  :return: ServersListingsGetOutput
  """
    request = MetorialRequest(
      path=['server-listings', serverListingId]
    )
    return self._get(request).transform(mapServersListingsGetOutput)