import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapServersListingsGetOutput,
  mapServersListingsListOutput,
  mapServersListingsListQuery,
  type ServersListingsGetOutput,
  type ServersListingsListOutput,
  type ServersListingsListQuery
} from '../resources';

/**
 * @name Server Listing controller
 * @description Read and write server version information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description List all server versions
   *
   * @param `query` - ServersListingsListQuery
   *
   * @returns ServersListingsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: ServersListingsListQuery) {
    return this._get({
      path: ['server-listings'],

      query: query ? mapServersListingsListQuery.transformTo(query) : undefined
    }).transform(mapServersListingsListOutput);
  }

  /**
   * @name Get server version
   * @description Get the information of a specific server version
   *
   * @param `serverListingId` - string
   *
   * @returns ServersListingsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverListingId: string) {
    return this._get({
      path: ['server-listings', serverListingId]
    }).transform(mapServersListingsGetOutput);
  }
}
