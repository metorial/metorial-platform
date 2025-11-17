import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSsoTenantsCreateBody,
  mapDashboardInstanceSsoTenantsCreateOutput,
  mapDashboardInstanceSsoTenantsGetOutput,
  mapDashboardInstanceSsoTenantsListOutput,
  mapDashboardInstanceSsoTenantsListQuery,
  type DashboardInstanceSsoTenantsCreateBody,
  type DashboardInstanceSsoTenantsCreateOutput,
  type DashboardInstanceSsoTenantsGetOutput,
  type DashboardInstanceSsoTenantsListOutput,
  type DashboardInstanceSsoTenantsListQuery
} from '../resources';

/**
 * @name SSO Tenants controller
 * @description SSO Tenants allow you to manage single sign-on configurations for your instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSsoTenantsEndpoint {
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
   * @param `query` - DashboardInstanceSsoTenantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSsoTenantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSsoTenantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSsoTenantsListOutput> {
    let path = `dashboard/instances/${instanceId}/sso-tenants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSsoTenantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSsoTenantsListOutput
    );
  }

  /**
   * @name Get SSO Tenant by ID
   * @description Retrieves details for a specific sso tenant by its ID.
   *
   * @param `instanceId` - string
   * @param `ssoTenantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSsoTenantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    ssoTenantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSsoTenantsGetOutput> {
    let path = `dashboard/instances/${instanceId}/sso-tenants/${ssoTenantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSsoTenantsGetOutput
    );
  }

  /**
   * @name Create SSO Tenant
   * @description Creates a new sso tenant for the instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSsoTenantsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSsoTenantsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSsoTenantsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSsoTenantsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/sso-tenants`;

    let request = {
      path,
      body: mapDashboardInstanceSsoTenantsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSsoTenantsCreateOutput
    );
  }
}
