from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapServersListingsCollectionsListOutput, ServersListingsCollectionsListOutput, mapServersListingsCollectionsListQuery, ServersListingsCollectionsListQuery, mapServersListingsCollectionsGetOutput, ServersListingsCollectionsGetOutput

class MetorialServersListingsCollectionsEndpoint(BaseMetorialEndpoint):
  """Read and write server version information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: ServersListingsCollectionsListQuery = None):
    """
  List server versions
  List all server versions

  :param query: ServersListingsCollectionsListQuery
  :return: ServersListingsCollectionsListOutput
  """
    request = MetorialRequest(
      path=['server-listing-collections'],
      query=mapServersListingsCollectionsListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapServersListingsCollectionsListOutput)

  def get(self, serverListingCollectionId: str):
    """
  Get server version
  Get the information of a specific server version

  :param serverListingCollectionId: str
  :return: ServersListingsCollectionsGetOutput
  """
    request = MetorialRequest(
      path=['server-listing-collections', serverListingCollectionId]
    )
    return self._get(request).transform(mapServersListingsCollectionsGetOutput)