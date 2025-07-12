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
 * @description Read and write server listing information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server listings
   * @description List all server listings
   *
   * @param `query` - ServersListingsListQuery
   *
   * @returns ServersListingsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: ServersListingsListQuery): Promise<ServersListingsListOutput> {
    let path = 'server-listings';
    return this._get({
      path,

      query: query ? mapServersListingsListQuery.transformTo(query) : undefined
    }).transform(mapServersListingsListOutput);
  }

  /**
   * @name Get server listing
   * @description Get the information of a specific server listing
   *
   * @param `serverListingId` - string
   *
   * @returns ServersListingsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverListingId: string): Promise<ServersListingsGetOutput> {
    let path = `server-listings/${serverListingId}`;
    return this._get({
      path
    }).transform(mapServersListingsGetOutput);
  }
}
