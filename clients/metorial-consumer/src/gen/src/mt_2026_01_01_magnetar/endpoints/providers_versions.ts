import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersVersionsGetOutput,
  mapDashboardInstanceProvidersVersionsListOutput,
  mapDashboardInstanceProvidersVersionsListQuery,
  type DashboardInstanceProvidersVersionsGetOutput,
  type DashboardInstanceProvidersVersionsListOutput,
  type DashboardInstanceProvidersVersionsListQuery
} from '../resources';

/**
 * @name Provider Versions controller
 * @description A version is a specific release of a provider (e.g., v1.2.0). Each version has its own tools, auth methods, and config schema. Deployments are pinned to a version for security reasons.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProvidersVersionsEndpoint {
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
   * @name List provider versions
   * @description Returns a paginated list of provider versions.
   *
   * @param `query` - DashboardInstanceProvidersVersionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersVersionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProvidersVersionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersVersionsListOutput> {
    let path = 'provider-versions';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersVersionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersVersionsListOutput
    );
  }

  /**
   * @name Get provider version
   * @description Retrieves a specific provider version by ID.
   *
   * @param `providerVersionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersVersionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerVersionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersVersionsGetOutput> {
    let path = `provider-versions/${providerVersionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersVersionsGetOutput
    );
  }
}
