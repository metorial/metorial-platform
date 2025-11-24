import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapServersListingsCategoriesGetOutput,
  mapServersListingsCategoriesListOutput,
  mapServersListingsCategoriesListQuery,
  type ServersListingsCategoriesGetOutput,
  type ServersListingsCategoriesListOutput,
  type ServersListingsCategoriesListQuery
} from '../resources';

/**
 * @name Server Listing Category controller
 * @description Provides access to server listing categories, used for organizing and filtering server listings.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersListingsCategoriesEndpoint {
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
   * @name List server listing categories
   * @description Returns a list of all available server listing categories.
   *
   * @param `query` - ServersListingsCategoriesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ServersListingsCategoriesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ServersListingsCategoriesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ServersListingsCategoriesListOutput> {
    let path = 'server-listing-categories';

    let request = {
      path,

      query: query
        ? mapServersListingsCategoriesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapServersListingsCategoriesListOutput);
  }

  /**
   * @name Get server listing category
   * @description Returns information for a specific server listing category.
   *
   * @param `serverListingCategoryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ServersListingsCategoriesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverListingCategoryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ServersListingsCategoriesGetOutput> {
    let path = `server-listing-categories/${serverListingCategoryId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapServersListingsCategoriesGetOutput);
  }
}
