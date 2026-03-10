import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersAuthMethodsGetOutput,
  mapDashboardInstanceProvidersAuthMethodsListOutput,
  mapDashboardInstanceProvidersAuthMethodsListQuery,
  type DashboardInstanceProvidersAuthMethodsGetOutput,
  type DashboardInstanceProvidersAuthMethodsListOutput,
  type DashboardInstanceProvidersAuthMethodsListQuery
} from '../resources';

/**
 * @name Provider Auth Methods controller
 * @description An auth method defines one way to authenticate with a provider (OAuth, API token, or custom credentials). A provider version may support multiple auth methods.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProvidersAuthMethodsEndpoint {
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
   * @name List provider auth methods
   * @description Returns a paginated list of provider auth methods.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProvidersAuthMethodsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersAuthMethodsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProvidersAuthMethodsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersAuthMethodsListOutput> {
    let path = `instances/${instanceId}/provider-auth-methods`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersAuthMethodsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersAuthMethodsListOutput
    );
  }

  /**
   * @name Get provider auth method
   * @description Retrieves a specific provider auth method by ID.
   *
   * @param `instanceId` - string
   * @param `providerAuthMethodId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersAuthMethodsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerAuthMethodId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersAuthMethodsGetOutput> {
    let path = `instances/${instanceId}/provider-auth-methods/${providerAuthMethodId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersAuthMethodsGetOutput
    );
  }
}
