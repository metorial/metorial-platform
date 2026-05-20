import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsAccessCreateBody,
  mapDashboardInstancePortalsAccessCreateOutput,
  mapDashboardInstancePortalsAccessDeleteOutput,
  mapDashboardInstancePortalsAccessGetOutput,
  mapDashboardInstancePortalsAccessListOutput,
  mapDashboardInstancePortalsAccessListQuery,
  mapDashboardInstancePortalsAccessUpdateBody,
  mapDashboardInstancePortalsAccessUpdateOutput,
  type DashboardInstancePortalsAccessCreateBody,
  type DashboardInstancePortalsAccessCreateOutput,
  type DashboardInstancePortalsAccessDeleteOutput,
  type DashboardInstancePortalsAccessGetOutput,
  type DashboardInstancePortalsAccessListOutput,
  type DashboardInstancePortalsAccessListQuery,
  type DashboardInstancePortalsAccessUpdateBody,
  type DashboardInstancePortalsAccessUpdateOutput
} from '../resources';

/**
 * @name Portal Access controller
 * @description Manage which consumer groups can access portal provider templates and MCP servers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsAccessEndpoint {
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
   * @name List portal access
   * @description Returns a paginated list of consumer access rules for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsAccessListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsAccessListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessListOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsAccessListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAccessListOutput
    );
  }

  /**
   * @name Get portal access
   * @description Retrieves a portal access rule by ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `accessId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    accessId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessGetOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access/${accessId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAccessGetOutput
    );
  }

  /**
   * @name Create portal access
   * @description Creates a new consumer access rule for the portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsAccessCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsAccessCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessCreateOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access`;

    let request = {
      path,
      body: mapDashboardInstancePortalsAccessCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsAccessCreateOutput
    );
  }

  /**
   * @name Update portal access
   * @description Updates the shared listing fields for a portal access rule.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `accessId` - string
   * @param `body` - DashboardInstancePortalsAccessUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    accessId: string,
    body: DashboardInstancePortalsAccessUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access/${accessId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsAccessUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsAccessUpdateOutput
    );
  }

  /**
   * @name Delete portal access
   * @description Deletes a consumer access rule from the portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `accessId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    accessId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access/${accessId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsAccessDeleteOutput
    );
  }
}
