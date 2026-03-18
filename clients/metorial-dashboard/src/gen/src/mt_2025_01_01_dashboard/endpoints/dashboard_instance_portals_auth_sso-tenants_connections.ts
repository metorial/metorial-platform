import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsAuthSsoTenantsConnectionsListOutput,
  mapDashboardInstancePortalsAuthSsoTenantsConnectionsListQuery,
  type DashboardInstancePortalsAuthSsoTenantsConnectionsListOutput,
  type DashboardInstancePortalsAuthSsoTenantsConnectionsListQuery
} from '../resources';

/**
 * @name Portal Auth controller
 * @description Manage the Ares-backed authentication configuration for a portal.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsAuthSsoTenantsConnectionsEndpoint {
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
   * @name List portal auth SSO tenant connections
   * @description Returns SSO connections that belong to a portal SSO tenant.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `ssoTenantId` - string
   * @param `query` - DashboardInstancePortalsAuthSsoTenantsConnectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAuthSsoTenantsConnectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    ssoTenantId: string,
    query?: DashboardInstancePortalsAuthSsoTenantsConnectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAuthSsoTenantsConnectionsListOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth/sso-tenants/${ssoTenantId}/connections`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsAuthSsoTenantsConnectionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAuthSsoTenantsConnectionsListOutput
    );
  }
}
