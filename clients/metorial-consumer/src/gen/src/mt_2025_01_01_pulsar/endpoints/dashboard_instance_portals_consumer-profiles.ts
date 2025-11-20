import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerProfilesAssignGroupsBody,
  mapDashboardInstancePortalsConsumerProfilesAssignGroupsOutput,
  mapDashboardInstancePortalsConsumerProfilesGetOutput,
  mapDashboardInstancePortalsConsumerProfilesListOutput,
  mapDashboardInstancePortalsConsumerProfilesListQuery,
  mapDashboardInstancePortalsConsumerProfilesUnassignGroupsBody,
  mapDashboardInstancePortalsConsumerProfilesUnassignGroupsOutput,
  type DashboardInstancePortalsConsumerProfilesAssignGroupsBody,
  type DashboardInstancePortalsConsumerProfilesAssignGroupsOutput,
  type DashboardInstancePortalsConsumerProfilesGetOutput,
  type DashboardInstancePortalsConsumerProfilesListOutput,
  type DashboardInstancePortalsConsumerProfilesListQuery,
  type DashboardInstancePortalsConsumerProfilesUnassignGroupsBody,
  type DashboardInstancePortalsConsumerProfilesUnassignGroupsOutput
} from '../resources';

/**
 * @name Portal Consumer Groups controller
 * @description Connect Magic MCP Groups to Portals to control access to your marketplaces.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsConsumerProfilesEndpoint {
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
   * @name List Portal
   * @description Returns a paginated list of portals.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsConsumerProfilesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerProfilesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsConsumerProfilesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerProfilesListOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-profile`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerProfilesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerProfilesListOutput
    );
  }

  /**
   * @name Get Portal Consumer Group by ID
   * @description Retrieves details for a specific portal by its ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerProfileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerProfilesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerProfileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerProfilesGetOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-profile/${consumerProfileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerProfilesGetOutput
    );
  }

  /**
   * @name Create Portal Consumer Group
   * @description Creates a new sso tenant for the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerProfileId` - string
   * @param `body` - DashboardInstancePortalsConsumerProfilesAssignGroupsBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerProfilesAssignGroupsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  assignGroups(
    instanceId: string,
    portalId: string,
    consumerProfileId: string,
    body: DashboardInstancePortalsConsumerProfilesAssignGroupsBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerProfilesAssignGroupsOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-profile/${consumerProfileId}/assign-groups`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerProfilesAssignGroupsBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerProfilesAssignGroupsOutput
    );
  }

  /**
   * @name Remove Portal Consumer Profile from Group
   * @description Removes a consumer profile from a consumer group.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerProfileId` - string
   * @param `body` - DashboardInstancePortalsConsumerProfilesUnassignGroupsBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerProfilesUnassignGroupsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  unassignGroups(
    instanceId: string,
    portalId: string,
    consumerProfileId: string,
    body: DashboardInstancePortalsConsumerProfilesUnassignGroupsBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerProfilesUnassignGroupsOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-profile/${consumerProfileId}/unassign-groups`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerProfilesUnassignGroupsBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerProfilesUnassignGroupsOutput
    );
  }
}
