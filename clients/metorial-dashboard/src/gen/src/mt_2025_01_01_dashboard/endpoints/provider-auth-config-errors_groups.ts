import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderAuthConfigErrorsGroupsGetOutput,
  mapDashboardInstanceProviderAuthConfigErrorsGroupsListOutput,
  mapDashboardInstanceProviderAuthConfigErrorsGroupsListQuery,
  type DashboardInstanceProviderAuthConfigErrorsGroupsGetOutput,
  type DashboardInstanceProviderAuthConfigErrorsGroupsListOutput,
  type DashboardInstanceProviderAuthConfigErrorsGroupsListQuery
} from '../resources';

/**
 * @name Provider Auth Config Errors controller
 * @description Provider auth config errors capture provider-side authentication failures and group repeated failures into reusable diagnostics.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderAuthConfigErrorsGroupsEndpoint {
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
   * @name List provider auth config error groups
   * @description Returns grouped provider auth config errors aggregated by type and canonical message.
   *
   * @param `query` - DashboardInstanceProviderAuthConfigErrorsGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderAuthConfigErrorsGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderAuthConfigErrorsGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderAuthConfigErrorsGroupsListOutput> {
    let path = 'provider-auth-config-error-groups';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderAuthConfigErrorsGroupsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderAuthConfigErrorsGroupsListOutput
    );
  }

  /**
   * @name Get provider auth config error group
   * @description Retrieves a specific grouped provider auth config error by ID.
   *
   * @param `providerAuthConfigErrorGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderAuthConfigErrorsGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerAuthConfigErrorGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderAuthConfigErrorsGroupsGetOutput> {
    let path = `provider-auth-config-error-groups/${providerAuthConfigErrorGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderAuthConfigErrorsGroupsGetOutput
    );
  }
}
