import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationInstanceProvidersGetOutput,
  mapDashboardInstanceIntegrationInstanceProvidersListOutput,
  mapDashboardInstanceIntegrationInstanceProvidersListQuery,
  mapDashboardInstanceIntegrationInstanceProvidersSetBody,
  mapDashboardInstanceIntegrationInstanceProvidersSetOutput,
  type DashboardInstanceIntegrationInstanceProvidersGetOutput,
  type DashboardInstanceIntegrationInstanceProvidersListOutput,
  type DashboardInstanceIntegrationInstanceProvidersListQuery,
  type DashboardInstanceIntegrationInstanceProvidersSetBody,
  type DashboardInstanceIntegrationInstanceProvidersSetOutput
} from '../resources';

/**
 * @name Integration Instance Providers controller
 * @description Integration instance providers resolve the effective per-instance provider materialization for an integration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceIntegrationInstanceProvidersEndpoint {
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
   * @name List integration instance providers
   * @description Returns a paginated list of integration instance providers.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationInstanceProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationInstanceProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceProvidersListOutput> {
    let path = `instances/${instanceId}/integration-instance-providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationInstanceProvidersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstanceProvidersListOutput
    );
  }

  /**
   * @name Get integration instance provider
   * @description Retrieves a specific integration instance provider.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationInstanceProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceProvidersGetOutput> {
    let path = `instances/${instanceId}/integration-instance-providers/${integrationInstanceProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstanceProvidersGetOutput
    );
  }

  /**
   * @name Set integration instance provider
   * @description Creates or updates the effective integration instance provider materialization.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `providerId` - string
   * @param `body` - DashboardInstanceIntegrationInstanceProvidersSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceProvidersSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    instanceId: string,
    integrationInstanceId: string,
    providerId: string,
    body: DashboardInstanceIntegrationInstanceProvidersSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceProvidersSetOutput> {
    let path = `instances/${instanceId}/integration-instances/${integrationInstanceId}/providers/${providerId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstanceProvidersSetBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardInstanceIntegrationInstanceProvidersSetOutput
    );
  }
}
