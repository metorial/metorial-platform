import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerAccessCreateBody,
  mapDashboardInstancePortalsConsumerAccessCreateOutput,
  mapDashboardInstancePortalsConsumerAccessDeleteOutput,
  mapDashboardInstancePortalsConsumerAccessGetOutput,
  mapDashboardInstancePortalsConsumerAccessListOutput,
  mapDashboardInstancePortalsConsumerAccessListQuery,
  mapDashboardInstancePortalsConsumerAccessUpdateBody,
  mapDashboardInstancePortalsConsumerAccessUpdateOutput,
  type DashboardInstancePortalsConsumerAccessCreateBody,
  type DashboardInstancePortalsConsumerAccessCreateOutput,
  type DashboardInstancePortalsConsumerAccessDeleteOutput,
  type DashboardInstancePortalsConsumerAccessGetOutput,
  type DashboardInstancePortalsConsumerAccessListOutput,
  type DashboardInstancePortalsConsumerAccessListQuery,
  type DashboardInstancePortalsConsumerAccessUpdateBody,
  type DashboardInstancePortalsConsumerAccessUpdateOutput
} from '../resources';

/**
 * @name Portal Consumer Access controller
 * @description Manage which consumer groups can access portal provider templates and MCP servers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePortalsConsumerAccessEndpoint {
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
   * @name List portal consumer access
   * @description Returns a paginated list of consumer access rules for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsConsumerAccessListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsConsumerAccessListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessListOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerAccessListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAccessListOutput
    );
  }

  /**
   * @name Get portal consumer access
   * @description Retrieves a portal consumer access rule by ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerAccessId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessGetOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access/${consumerAccessId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAccessGetOutput
    );
  }

  /**
   * @name Create portal consumer access
   * @description Creates a new consumer access rule for the portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsConsumerAccessCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsConsumerAccessCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessCreateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerAccessCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerAccessCreateOutput
    );
  }

  /**
   * @name Update portal consumer access
   * @description Updates the shared listing fields for a portal consumer access rule.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessId` - string
   * @param `body` - DashboardInstancePortalsConsumerAccessUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    consumerAccessId: string,
    body: DashboardInstancePortalsConsumerAccessUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessUpdateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access/${consumerAccessId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerAccessUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsConsumerAccessUpdateOutput
    );
  }

  /**
   * @name Delete portal consumer access
   * @description Deletes a consumer access rule from the portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    consumerAccessId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessDeleteOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access/${consumerAccessId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsConsumerAccessDeleteOutput
    );
  }
}
