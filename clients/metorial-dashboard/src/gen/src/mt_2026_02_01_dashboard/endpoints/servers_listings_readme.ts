import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapServersListingsReadmeGetOutput,
  mapServersListingsReadmeGetQuery,
  type ServersListingsReadmeGetOutput,
  type ServersListingsReadmeGetQuery
} from '../resources';

/**
 * @name Server Listing controller
 * @description Provides access to public server listings, including metadata, filtering, and ranking.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsReadmeEndpoint {
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
   * @name Get server listing readme
   * @description Returns metadata and readme content for a specific server listing.
   *
   * @param `serverListingId` - string
   * @param `query` - ServersListingsReadmeGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ServersListingsReadmeGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverListingId: string,
    query?: ServersListingsReadmeGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ServersListingsReadmeGetOutput> {
    let path = `server-listings/${serverListingId}/readme`;

    let request = {
      path,

      query: query
        ? mapServersListingsReadmeGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapServersListingsReadmeGetOutput);
  }
}
