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
export class MetorialManagementInstanceServersListingsCollectionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description List all server versions
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersListingsCollectionsListQuery
   *
   * @returns DashboardInstanceServersListingsCollectionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServersListingsCollectionsListQuery
  ) {
    return this._get({
      path: ['instances', instanceId, 'server-listing-collections'],

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
   * @param `instanceId` - string
   * @param `serverListingCollectionId` - string
   *
   * @returns DashboardInstanceServersListingsCollectionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverListingCollectionId: string) {
    return this._get({
      path: [
        'instances',
        instanceId,
        'server-listing-collections',
        serverListingCollectionId
      ]
    }).transform(mapDashboardInstanceServersListingsCollectionsGetOutput);
  }
}
