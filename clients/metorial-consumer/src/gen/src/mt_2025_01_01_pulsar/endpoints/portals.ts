import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsCreateBody,
  mapDashboardInstancePortalsCreateOutput,
  mapDashboardInstancePortalsDeleteOutput,
  mapDashboardInstancePortalsGetOutput,
  mapDashboardInstancePortalsListOutput,
  mapDashboardInstancePortalsListQuery,
  mapDashboardInstancePortalsUpdateBody,
  mapDashboardInstancePortalsUpdateOutput,
  type DashboardInstancePortalsCreateBody,
  type DashboardInstancePortalsCreateOutput,
  type DashboardInstancePortalsDeleteOutput,
  type DashboardInstancePortalsGetOutput,
  type DashboardInstancePortalsListOutput,
  type DashboardInstancePortalsListQuery,
  type DashboardInstancePortalsUpdateBody,
  type DashboardInstancePortalsUpdateOutput
} from '../resources';

/**
 * @name Portal controller
 * @description Use Portals to create custom branded MCP server marketplaces for your organization.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialPortalsEndpoint {
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
   * @param `query` - DashboardInstancePortalsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstancePortalsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsListOutput> {
    let path = 'portals';

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstancePortalsListOutput);
  }

  /**
   * @name Get SSO Tenant by ID
   * @description Retrieves details for a specific portal by its ID.
   *
   * @param `portalId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    portalId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsGetOutput> {
    let path = `portals/${portalId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstancePortalsGetOutput);
  }

  /**
   * @name Create SSO Tenant
   * @description Creates a new sso tenant for the instance.
   *
   * @param `body` - DashboardInstancePortalsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstancePortalsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsCreateOutput> {
    let path = 'portals';

    let request = {
      path,
      body: mapDashboardInstancePortalsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsCreateOutput
    );
  }

  /**
   * @name Update Portal
   * @description Updates an existing portal for the instance.
   *
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    portalId: string,
    body: DashboardInstancePortalsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsUpdateOutput> {
    let path = `portals/${portalId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsUpdateOutput
    );
  }

  /**
   * @name Delete Portal
   * @description Deletes a portal from the instance.
   *
   * @param `portalId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    portalId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsDeleteOutput> {
    let path = `portals/${portalId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsDeleteOutput
    );
  }
}
