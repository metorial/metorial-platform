import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerGroupsCreateBody,
  mapDashboardInstancePortalsConsumerGroupsCreateOutput,
  mapDashboardInstancePortalsConsumerGroupsDeleteOutput,
  mapDashboardInstancePortalsConsumerGroupsGetOutput,
  mapDashboardInstancePortalsConsumerGroupsListOutput,
  mapDashboardInstancePortalsConsumerGroupsListQuery,
  type DashboardInstancePortalsConsumerGroupsCreateBody,
  type DashboardInstancePortalsConsumerGroupsCreateOutput,
  type DashboardInstancePortalsConsumerGroupsDeleteOutput,
  type DashboardInstancePortalsConsumerGroupsGetOutput,
  type DashboardInstancePortalsConsumerGroupsListOutput,
  type DashboardInstancePortalsConsumerGroupsListQuery
} from '../resources';

/**
 * @name Portal Consumer Groups controller
 * @description Connect Magic MCP Groups to Portals to control access to your marketplaces.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePortalsConsumerGroupsEndpoint {
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
   * @param `query` - DashboardInstancePortalsConsumerGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsConsumerGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsListOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-groups`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerGroupsListOutput
    );
  }

  /**
   * @name Get Portal Consumer Group by ID
   * @description Retrieves details for a specific portal by its ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsGetOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-groups/${consumerGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerGroupsGetOutput
    );
  }

  /**
   * @name Create Portal Consumer Group
   * @description Creates a new sso tenant for the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsConsumerGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsConsumerGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsCreateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-groups`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerGroupsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerGroupsCreateOutput
    );
  }

  /**
   * @name Delete Portal
   * @description Deletes a portal from the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    consumerGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsDeleteOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-groups/${consumerGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsConsumerGroupsDeleteOutput
    );
  }
}
