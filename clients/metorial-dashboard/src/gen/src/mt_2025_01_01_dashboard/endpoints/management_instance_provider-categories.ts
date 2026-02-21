import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderCategoriesGetOutput,
  mapDashboardInstanceProviderCategoriesListOutput,
  mapDashboardInstanceProviderCategoriesListQuery,
  type DashboardInstanceProviderCategoriesGetOutput,
  type DashboardInstanceProviderCategoriesListOutput,
  type DashboardInstanceProviderCategoriesListQuery
} from '../resources';

/**
 * @name Provider Categories controller
 * @description A category groups providers by function like 'Developer Tools' or 'ERPs'.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderCategoriesEndpoint {
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
   * @name List provider categories
   * @description Returns a paginated list of provider categories.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderCategoriesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderCategoriesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderCategoriesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderCategoriesListOutput> {
    let path = `instances/${instanceId}/provider-categories`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderCategoriesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderCategoriesListOutput
    );
  }

  /**
   * @name Get provider category
   * @description Retrieves a specific provider category by ID.
   *
   * @param `instanceId` - string
   * @param `providerCategoryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderCategoriesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerCategoryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderCategoriesGetOutput> {
    let path = `instances/${instanceId}/provider-categories/${providerCategoryId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderCategoriesGetOutput
    );
  }
}
