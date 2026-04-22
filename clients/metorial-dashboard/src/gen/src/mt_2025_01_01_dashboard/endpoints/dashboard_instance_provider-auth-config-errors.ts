import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderAuthConfigErrorsGetOutput,
  mapDashboardInstanceProviderAuthConfigErrorsListOutput,
  mapDashboardInstanceProviderAuthConfigErrorsListQuery,
  type DashboardInstanceProviderAuthConfigErrorsGetOutput,
  type DashboardInstanceProviderAuthConfigErrorsListOutput,
  type DashboardInstanceProviderAuthConfigErrorsListQuery
} from '../resources';

/**
 * @name Provider Auth Config Errors controller
 * @description Provider auth config errors capture provider-side authentication failures and group repeated failures into reusable diagnostics.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderAuthConfigErrorsEndpoint {
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
   * @name List provider auth config errors
   * @description Returns a paginated list of provider auth config errors for dashboard diagnostics.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderAuthConfigErrorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderAuthConfigErrorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderAuthConfigErrorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderAuthConfigErrorsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-errors`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderAuthConfigErrorsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderAuthConfigErrorsListOutput
    );
  }

  /**
   * @name Get provider auth config error
   * @description Retrieves a specific provider auth config error by ID.
   *
   * @param `instanceId` - string
   * @param `providerAuthConfigErrorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderAuthConfigErrorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerAuthConfigErrorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderAuthConfigErrorsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-errors/${providerAuthConfigErrorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderAuthConfigErrorsGetOutput
    );
  }
}
