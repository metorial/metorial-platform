import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapServersListingsGetOutput,
  mapServersListingsGetQuery,
  mapServersListingsListOutput,
  mapServersListingsListQuery,
  type ServersListingsGetOutput,
  type ServersListingsGetQuery,
  type ServersListingsListOutput,
  type ServersListingsListQuery
} from '../resources';

/**
 * @name Server Listing controller
 * @description Provides access to public server listings, including metadata, filtering, and ranking.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name List server listings
   * @description Returns a paginated list of server listings, filterable by collection, category, profile, or instance.
   *
   * @param `query` - ServersListingsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ServersListingsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ServersListingsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ServersListingsListOutput> {
    let path = 'server-listings';

    let request = {
      path,

      query: query ? mapServersListingsListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapServersListingsListOutput);
  }

  /**
   * @name Get server listing
   * @description Returns metadata and readme content for a specific server listing.
   *
   * @param `serverListingId` - string
   * @param `query` - ServersListingsGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ServersListingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverListingId: string,
    query?: ServersListingsGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ServersListingsGetOutput> {
    let path = `server-listings/${serverListingId}`;

    let request = {
      path,

      query: query ? mapServersListingsGetQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapServersListingsGetOutput);
  }
}
