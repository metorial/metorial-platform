import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersListingsCollectionsGetOutput,
  mapDashboardInstanceServersListingsCollectionsListOutput,
  mapDashboardInstanceServersListingsCollectionsListQuery,
  type DashboardInstanceServersListingsCollectionsGetOutput,
  type DashboardInstanceServersListingsCollectionsListOutput,
  type DashboardInstanceServersListingsCollectionsListQuery
} from '../resources';

/**
 * @name Server Collection controller
 * @description Read and write server version information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsCollectionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description List all server versions
   *
   * @param `query` - DashboardInstanceServersListingsCollectionsListQuery
   *
   * @returns DashboardInstanceServersListingsCollectionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceServersListingsCollectionsListQuery) {
    return this._get({
      path: ['server-listing-collections'],

      query: query
        ? mapDashboardInstanceServersListingsCollectionsListQuery.transformTo(
            query
          )
        : undefined
    }).transform(mapDashboardInstanceServersListingsCollectionsListOutput);
  }

  /**
   * @name Get server version
   * @description Get the information of a specific server version
   *
   * @param `serverListingCollectionId` - string
   *
   * @returns DashboardInstanceServersListingsCollectionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverListingCollectionId: string) {
    return this._get({
      path: ['server-listing-collections', serverListingCollectionId]
    }).transform(mapDashboardInstanceServersListingsCollectionsGetOutput);
  }
}
