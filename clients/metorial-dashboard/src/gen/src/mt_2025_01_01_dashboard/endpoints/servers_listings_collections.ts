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
export class MetorialServersListingsCollectionsEndpoint {
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
   * @name List server listing collections
   * @description List all server listing collections
   *
   * @param `query` - ServersListingsCollectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ServersListingsCollectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ServersListingsCollectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ServersListingsCollectionsListOutput> {
    let path = 'server-listing-collections';

    let request = {
      path,

      query: query
        ? mapServersListingsCollectionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapServersListingsCollectionsListOutput
    );
  }

  /**
   * @name Get server listing collection
   * @description Get the information of a specific server listing collection
   *
   * @param `serverListingCollectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ServersListingsCollectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverListingCollectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ServersListingsCollectionsGetOutput> {
    let path = `server-listing-collections/${serverListingCollectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapServersListingsCollectionsGetOutput);
  }
}
