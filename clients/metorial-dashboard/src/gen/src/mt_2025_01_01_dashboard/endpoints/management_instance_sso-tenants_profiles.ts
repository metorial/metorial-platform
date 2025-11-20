import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSsoTenantsProfilesGetOutput,
  mapDashboardInstanceSsoTenantsProfilesListOutput,
  mapDashboardInstanceSsoTenantsProfilesListQuery,
  type DashboardInstanceSsoTenantsProfilesGetOutput,
  type DashboardInstanceSsoTenantsProfilesListOutput,
  type DashboardInstanceSsoTenantsProfilesListQuery
} from '../resources';

/**
 * @name SSO Profiles controller
 * @description SSO Profiles allow you to manage single sign-on configurations for your instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSsoTenantsProfilesEndpoint {
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
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSsoTenantsProfilesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSsoTenantsProfilesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSsoTenantsProfilesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSsoTenantsProfilesListOutput> {
    let path = `instances/${instanceId}/sso-profiles`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSsoTenantsProfilesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSsoTenantsProfilesListOutput
    );
  }

  /**
   * @name Get SSO Tenant by ID
   * @description Retrieves details for a specific sso tenant by its ID.
   *
   * @param `instanceId` - string
   * @param `ssoProfileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSsoTenantsProfilesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    ssoProfileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSsoTenantsProfilesGetOutput> {
    let path = `instances/${instanceId}/sso-profiles/${ssoProfileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSsoTenantsProfilesGetOutput
    );
  }
}
