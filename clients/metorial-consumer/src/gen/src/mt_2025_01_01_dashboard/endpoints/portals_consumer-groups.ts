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
  mapDashboardInstancePortalsConsumerGroupsUpdateBody,
  mapDashboardInstancePortalsConsumerGroupsUpdateOutput,
  type DashboardInstancePortalsConsumerGroupsCreateBody,
  type DashboardInstancePortalsConsumerGroupsCreateOutput,
  type DashboardInstancePortalsConsumerGroupsDeleteOutput,
  type DashboardInstancePortalsConsumerGroupsGetOutput,
  type DashboardInstancePortalsConsumerGroupsListOutput,
  type DashboardInstancePortalsConsumerGroupsListQuery,
  type DashboardInstancePortalsConsumerGroupsUpdateBody,
  type DashboardInstancePortalsConsumerGroupsUpdateOutput
} from '../resources';

/**
 * @name Portal Consumer Groups controller
 * @description Connect Magic MCP Groups to Portals to control access to your marketplaces.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialPortalsConsumerGroupsEndpoint {
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
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsConsumerGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    portalId: string,
    query?: DashboardInstancePortalsConsumerGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsListOutput> {
    let path = `portals/${portalId}/consumer-groups`;

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
   * @param `portalId` - string
   * @param `consumerGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    portalId: string,
    consumerGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsGetOutput> {
    let path = `portals/${portalId}/consumer-groups/${consumerGroupId}`;

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
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsConsumerGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    portalId: string,
    body: DashboardInstancePortalsConsumerGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsCreateOutput> {
    let path = `portals/${portalId}/consumer-groups`;

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
   * @name Update Portal Consumer Group
   * @description Updates an existing portal consumer group.
   *
   * @param `portalId` - string
   * @param `consumerGroupId` - string
   * @param `body` - DashboardInstancePortalsConsumerGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    portalId: string,
    consumerGroupId: string,
    body: DashboardInstancePortalsConsumerGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsUpdateOutput> {
    let path = `portals/${portalId}/consumer-groups/${consumerGroupId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerGroupsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardInstancePortalsConsumerGroupsUpdateOutput
    );
  }

  /**
   * @name Delete Portal
   * @description Deletes a portal from the instance.
   *
   * @param `portalId` - string
   * @param `consumerGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    portalId: string,
    consumerGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerGroupsDeleteOutput> {
    let path = `portals/${portalId}/consumer-groups/${consumerGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsConsumerGroupsDeleteOutput
    );
  }
}
