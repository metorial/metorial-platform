import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderCollectionsGetOutput,
  mapDashboardInstanceProviderCollectionsListOutput,
  mapDashboardInstanceProviderCollectionsListQuery,
  type DashboardInstanceProviderCollectionsGetOutput,
  type DashboardInstanceProviderCollectionsListOutput,
  type DashboardInstanceProviderCollectionsListQuery
} from '../resources';

/**
 * @name Provider Collections controller
 * @description A collection is a curated set of providers like 'Featured', 'Most Popular', or 'New Arrivals'.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderCollectionsEndpoint {
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
   * @name List provider collections
   * @description Returns a paginated list of provider collections.
   *
   * @param `query` - DashboardInstanceProviderCollectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderCollectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderCollectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderCollectionsListOutput> {
    let path = 'provider-collections';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderCollectionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderCollectionsListOutput
    );
  }

  /**
   * @name Get provider collection
   * @description Retrieves a specific provider collection by ID.
   *
   * @param `providerCollectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderCollectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerCollectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderCollectionsGetOutput> {
    let path = `provider-collections/${providerCollectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderCollectionsGetOutput
    );
  }
}
