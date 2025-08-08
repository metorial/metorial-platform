import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapServersListingsCollectionsGetOutput,
  mapServersListingsCollectionsListOutput,
  mapServersListingsCollectionsListQuery,
  type ServersListingsCollectionsGetOutput,
  type ServersListingsCollectionsListOutput,
  type ServersListingsCollectionsListQuery
} from '../resources';

/**
 * @name Server Listing Collection controller
 * @description Read and write server listing collection information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsCollectionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server listing collections
   * @description List all server listing collections
   *
   * @param `query` - ServersListingsCollectionsListQuery
   *
   * @returns ServersListingsCollectionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ServersListingsCollectionsListQuery
  ): Promise<ServersListingsCollectionsListOutput> {
    let path = 'server-listing-collections';
    return this._get({
      path,

      query: query
        ? mapServersListingsCollectionsListQuery.transformTo(query)
        : undefined
    }).transform(mapServersListingsCollectionsListOutput);
  }

  /**
   * @name Get server listing collection
   * @description Get the information of a specific server listing collection
   *
   * @param `serverListingCollectionId` - string
   *
   * @returns ServersListingsCollectionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverListingCollectionId: string
  ): Promise<ServersListingsCollectionsGetOutput> {
    let path = `server-listing-collections/${serverListingCollectionId}`;
    return this._get({
      path
    }).transform(mapServersListingsCollectionsGetOutput);
  }
}
