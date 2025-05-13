import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersListingsGetOutput,
  mapDashboardInstanceServersListingsListOutput,
  mapDashboardInstanceServersListingsListQuery,
  type DashboardInstanceServersListingsGetOutput,
  type DashboardInstanceServersListingsListOutput,
  type DashboardInstanceServersListingsListQuery
} from '../resources';

/**
 * @name Server Listing controller
 * @description Read and write server version information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServersListingsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description List all server versions
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersListingsListQuery
   *
   * @returns DashboardInstanceServersListingsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, query?: DashboardInstanceServersListingsListQuery) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'server-listings'],

      query: query
        ? mapDashboardInstanceServersListingsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersListingsListOutput);
  }

  /**
   * @name Get server version
   * @description Get the information of a specific server version
   *
   * @param `instanceId` - string
   * @param `serverListingId` - string
   *
   * @returns DashboardInstanceServersListingsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverListingId: string) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'server-listings',
        serverListingId
      ]
    }).transform(mapDashboardInstanceServersListingsGetOutput);
  }
}
