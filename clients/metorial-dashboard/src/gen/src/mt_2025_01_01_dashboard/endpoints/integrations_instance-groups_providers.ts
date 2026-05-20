import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsProvidersGetOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsProvidersListOutput,
  mapDashboardInstanceIntegrationsInstanceGroupsProvidersListQuery,
  mapDashboardInstanceIntegrationsInstanceGroupsProvidersSetBody,
  mapDashboardInstanceIntegrationsInstanceGroupsProvidersSetOutput,
  type DashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput,
  type DashboardInstanceIntegrationsInstanceGroupsProvidersGetOutput,
  type DashboardInstanceIntegrationsInstanceGroupsProvidersListOutput,
  type DashboardInstanceIntegrationsInstanceGroupsProvidersListQuery,
  type DashboardInstanceIntegrationsInstanceGroupsProvidersSetBody,
  type DashboardInstanceIntegrationsInstanceGroupsProvidersSetOutput
} from '../resources';

/**
 * @name Integration Instance Group Providers controller
 * @description Integration instance group providers define the effective routed provider set for an integration instance group.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialIntegrationsInstanceGroupsProvidersEndpoint {
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
   * @param `query` - DashboardInstanceIntegrationsInstanceGroupsProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceIntegrationsInstanceGroupsProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsProvidersListOutput> {
    let path = 'integration-instance-group-providers';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIntegrationsInstanceGroupsProvidersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsProvidersListOutput
    );
  }

  /**
   * @name Get integration instance group provider
   * @description Retrieves a specific integration instance group provider.
   *
   * @param `integrationInstanceGroupProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    integrationInstanceGroupProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsProvidersGetOutput> {
    let path = `integration-instance-group-providers/${integrationInstanceGroupProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsProvidersGetOutput
    );
  }

  /**
   * @name Set integration instance group provider
   * @description Creates or updates the effective integration instance group provider materialization.
   *
   * @param `integrationInstanceGroupId` - string
   * @param `integrationInstanceProviderId` - string
   * @param `body` - DashboardInstanceIntegrationsInstanceGroupsProvidersSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsProvidersSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    integrationInstanceGroupId: string,
    integrationInstanceProviderId: string,
    body: DashboardInstanceIntegrationsInstanceGroupsProvidersSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsProvidersSetOutput> {
    let path = `integration-instance-groups/${integrationInstanceGroupId}/providers/${integrationInstanceProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceIntegrationsInstanceGroupsProvidersSetBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsProvidersSetOutput
    );
  }

  /**
   * @name Delete integration instance group provider
   * @description Archives a specific integration instance group provider.
   *
   * @param `integrationInstanceGroupProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    integrationInstanceGroupProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput> {
    let path = `integration-instance-group-providers/${integrationInstanceGroupProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput
    );
  }
}
