from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
from ..resources import mapServersListingsCategoriesListOutput, ServersListingsCategoriesListOutput, mapServersListingsCategoriesListQuery, ServersListingsCategoriesListQuery, mapServersListingsCategoriesGetOutput, ServersListingsCategoriesGetOutput

class MetorialServersListingsCategoriesEndpoint(BaseMetorialEndpoint):
  """Read and write server version information"""

  def __init__(self, config: MetorialEndpointManager):
    super().__init__(config)

  def list(self, query: ServersListingsCategoriesListQuery = None):
    """
  List server versions
  List all server versions

  :param query: ServersListingsCategoriesListQuery
  :return: ServersListingsCategoriesListOutput
  """
    request = MetorialRequest(
      path=['server-listing-categories'],
      query=mapServersListingsCategoriesListQuery.transform_to(query) if query is not None else None,
    )
    return self._get(request).transform(mapServersListingsCategoriesListOutput)

  def get(self, serverListingCategoryId: str):
    """
  Get server version
  Get the information of a specific server version

  :param serverListingCategoryId: str
  :return: ServersListingsCategoriesGetOutput
  """
    request = MetorialRequest(
      path=['server-listing-categories', serverListingCategoryId]
    )
    return self._get(request).transform(mapServersListingsCategoriesGetOutput)