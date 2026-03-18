import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsAuthSsoTenantsCreateBody,
  mapDashboardInstancePortalsAuthSsoTenantsCreateOutput,
  mapDashboardInstancePortalsAuthSsoTenantsListOutput,
  mapDashboardInstancePortalsAuthSsoTenantsListQuery,
  mapDashboardInstancePortalsAuthSsoTenantsSetupOutput,
  type DashboardInstancePortalsAuthSsoTenantsCreateBody,
  type DashboardInstancePortalsAuthSsoTenantsCreateOutput,
  type DashboardInstancePortalsAuthSsoTenantsListOutput,
  type DashboardInstancePortalsAuthSsoTenantsListQuery,
  type DashboardInstancePortalsAuthSsoTenantsSetupOutput
} from '../resources';

/**
 * @name Portal Auth controller
 * @description Manage the Ares-backed authentication configuration for a portal.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialPortalsAuthSsoTenantsEndpoint {
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
   * @name List portal auth SSO tenants
   * @description Returns the SSO tenants configured for a portal Ares app.
   *
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsAuthSsoTenantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAuthSsoTenantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    portalId: string,
    query?: DashboardInstancePortalsAuthSsoTenantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAuthSsoTenantsListOutput> {
    let path = `portals/${portalId}/auth/sso-tenants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsAuthSsoTenantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAuthSsoTenantsListOutput
    );
  }

  /**
   * @name Create portal auth SSO tenant
   * @description Creates an SSO tenant for the portal Ares app.
   *
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsAuthSsoTenantsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAuthSsoTenantsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    portalId: string,
    body: DashboardInstancePortalsAuthSsoTenantsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAuthSsoTenantsCreateOutput> {
    let path = `portals/${portalId}/auth/sso-tenants`;

    let request = {
      path,
      body: mapDashboardInstancePortalsAuthSsoTenantsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsAuthSsoTenantsCreateOutput
    );
  }

  /**
   * @name Create portal auth SSO tenant setup
   * @description Creates an Ares setup URL for finishing portal SSO tenant configuration.
   *
   * @param `portalId` - string
   * @param `ssoTenantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAuthSsoTenantsSetupOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  setup(
    portalId: string,
    ssoTenantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAuthSsoTenantsSetupOutput> {
    let path = `portals/${portalId}/auth/sso-tenants/${ssoTenantId}/setup`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsAuthSsoTenantsSetupOutput
    );
  }
}
