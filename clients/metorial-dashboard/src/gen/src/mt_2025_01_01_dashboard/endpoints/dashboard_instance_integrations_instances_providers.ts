import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsInstancesProvidersGetOutput,
  mapDashboardInstanceIntegrationsInstancesProvidersListOutput,
  mapDashboardInstanceIntegrationsInstancesProvidersListQuery,
  mapDashboardInstanceIntegrationsInstancesProvidersSetBody,
  mapDashboardInstanceIntegrationsInstancesProvidersSetOutput,
  type DashboardInstanceIntegrationsInstancesProvidersGetOutput,
  type DashboardInstanceIntegrationsInstancesProvidersListOutput,
  type DashboardInstanceIntegrationsInstancesProvidersListQuery,
  type DashboardInstanceIntegrationsInstancesProvidersSetBody,
  type DashboardInstanceIntegrationsInstancesProvidersSetOutput
} from '../resources';

/**
 * @name Integration Instance Providers controller
 * @description Integration instance providers resolve the effective per-instance provider materialization for an integration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIntegrationsInstancesProvidersEndpoint {
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
   * @param `query` - DashboardInstanceIntegrationsInstancesProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationsInstancesProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesProvidersListOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsInstancesProvidersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstancesProvidersListOutput
    );
  }

  /**
   * @name Get integration instance provider
   * @description Retrieves a specific integration instance provider.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationInstanceProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesProvidersGetOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-providers/${integrationInstanceProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstancesProvidersGetOutput
    );
  }

  /**
   * @name Set integration instance provider
   * @description Creates or updates the effective integration instance provider materialization.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceId` - string
   * @param `providerId` - string
   * @param `body` - DashboardInstanceIntegrationsInstancesProvidersSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstancesProvidersSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    instanceId: string,
    integrationInstanceId: string,
    providerId: string,
    body: DashboardInstanceIntegrationsInstancesProvidersSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstancesProvidersSetOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instances/${integrationInstanceId}/providers/${providerId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstancesProvidersSetBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardInstanceIntegrationsInstancesProvidersSetOutput
    );
  }
}
