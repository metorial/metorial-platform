import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationInstanceGroupProvidersDeleteOutput,
  mapDashboardInstanceIntegrationInstanceGroupProvidersGetOutput,
  mapDashboardInstanceIntegrationInstanceGroupProvidersListOutput,
  mapDashboardInstanceIntegrationInstanceGroupProvidersListQuery,
  mapDashboardInstanceIntegrationInstanceGroupProvidersSetBody,
  mapDashboardInstanceIntegrationInstanceGroupProvidersSetOutput,
  type DashboardInstanceIntegrationInstanceGroupProvidersDeleteOutput,
  type DashboardInstanceIntegrationInstanceGroupProvidersGetOutput,
  type DashboardInstanceIntegrationInstanceGroupProvidersListOutput,
  type DashboardInstanceIntegrationInstanceGroupProvidersListQuery,
  type DashboardInstanceIntegrationInstanceGroupProvidersSetBody,
  type DashboardInstanceIntegrationInstanceGroupProvidersSetOutput
} from '../resources';

/**
 * @name Integration Instance Group Providers controller
 * @description Integration instance group providers define the effective routed provider set for an integration instance group.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIntegrationInstanceGroupProvidersEndpoint {
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
   * @name List integration instance group providers
   * @description Returns a paginated list of integration instance group providers.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIntegrationInstanceGroupProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIntegrationInstanceGroupProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupProvidersListOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-group-providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationInstanceGroupProvidersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupProvidersListOutput
    );
  }

  /**
   * @name Get integration instance group provider
   * @description Retrieves a specific integration instance group provider.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    integrationInstanceGroupProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupProvidersGetOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-group-providers/${integrationInstanceGroupProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupProvidersGetOutput
    );
  }

  /**
   * @name Set integration instance group provider
   * @description Creates or updates the effective integration instance group provider materialization.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupId` - string
   * @param `integrationInstanceProviderId` - string
   * @param `body` - DashboardInstanceIntegrationInstanceGroupProvidersSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupProvidersSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    instanceId: string,
    integrationInstanceGroupId: string,
    integrationInstanceProviderId: string,
    body: DashboardInstanceIntegrationInstanceGroupProvidersSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupProvidersSetOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-groups/${integrationInstanceGroupId}/providers/${integrationInstanceProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationInstanceGroupProvidersSetBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupProvidersSetOutput
    );
  }

  /**
   * @name Delete integration instance group provider
   * @description Archives a specific integration instance group provider.
   *
   * @param `instanceId` - string
   * @param `integrationInstanceGroupProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationInstanceGroupProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    integrationInstanceGroupProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationInstanceGroupProvidersDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/integration-instance-group-providers/${integrationInstanceGroupProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationInstanceGroupProvidersDeleteOutput
    );
  }
}
