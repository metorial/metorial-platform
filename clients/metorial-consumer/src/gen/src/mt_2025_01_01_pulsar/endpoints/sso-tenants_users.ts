import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSsoTenantsUsersGetOutput,
  mapDashboardInstanceSsoTenantsUsersListOutput,
  mapDashboardInstanceSsoTenantsUsersListQuery,
  type DashboardInstanceSsoTenantsUsersGetOutput,
  type DashboardInstanceSsoTenantsUsersListOutput,
  type DashboardInstanceSsoTenantsUsersListQuery
} from '../resources';

/**
 * @name SSO Users controller
 * @description SSO Users allow you to manage single sign-on configurations for your instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSsoTenantsUsersEndpoint {
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
   * @name List SSO Tenants
   * @description Returns a paginated list of sso tenants.
   *
   * @param `query` - DashboardInstanceSsoTenantsUsersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSsoTenantsUsersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSsoTenantsUsersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSsoTenantsUsersListOutput> {
    let path = 'sso-users';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSsoTenantsUsersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSsoTenantsUsersListOutput
    );
  }

  /**
   * @name Get SSO Tenant by ID
   * @description Retrieves details for a specific sso tenant by its ID.
   *
   * @param `ssoUserId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSsoTenantsUsersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    ssoUserId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSsoTenantsUsersGetOutput> {
    let path = `sso-users/${ssoUserId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSsoTenantsUsersGetOutput
    );
  }
}
