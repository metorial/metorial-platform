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
 * @description An integration instance group provider links one integration instance provider into a group, with optional tool filters.
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
   * @description Retrieves an integration instance group provider.
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
    let path = `integration-instance-group-providers/${encodeURIComponent(integrationInstanceGroupProviderId)}`;

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
   * @description Links an existing integration instance provider into the group, with optional tool filters. Creates the link when none exists, otherwise updates its tool filters.
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
    let path = `integration-instance-groups/${encodeURIComponent(integrationInstanceGroupId)}/providers/${encodeURIComponent(integrationInstanceProviderId)}`;

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
   * @name Archive integration instance group provider
   * @description Archives an integration instance group provider. It stays retrievable by ID and listable with `status=archived`.
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
    let path = `integration-instance-group-providers/${encodeURIComponent(integrationInstanceGroupProviderId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIntegrationsInstanceGroupsProvidersDeleteOutput
    );
  }
}
