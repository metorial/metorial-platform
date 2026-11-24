import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsListingsCreateBody,
  mapDashboardInstancePortalsListingsCreateOutput,
  mapDashboardInstancePortalsListingsDeleteOutput,
  mapDashboardInstancePortalsListingsGetOutput,
  mapDashboardInstancePortalsListingsListOutput,
  mapDashboardInstancePortalsListingsListQuery,
  mapDashboardInstancePortalsListingsUpdateBody,
  mapDashboardInstancePortalsListingsUpdateOutput,
  type DashboardInstancePortalsListingsCreateBody,
  type DashboardInstancePortalsListingsCreateOutput,
  type DashboardInstancePortalsListingsDeleteOutput,
  type DashboardInstancePortalsListingsGetOutput,
  type DashboardInstancePortalsListingsListOutput,
  type DashboardInstancePortalsListingsListQuery,
  type DashboardInstancePortalsListingsUpdateBody,
  type DashboardInstancePortalsListingsUpdateOutput
} from '../resources';

/**
 * @name Portal Listings controller
 * @description A portal listing is the shared catalog entry for one integration, skill, or skill set on a portal. Access rules decide which consumer groups see it.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePortalsListingsEndpoint {
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
   * @name List portal listings
   * @description Returns a paginated list of shared listings for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsListingsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsListingsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsListingsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsListingsListOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/portals/${encodeURIComponent(portalId)}/listings`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsListingsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsListingsListOutput
    );
  }

  /**
   * @name Get portal listing
   * @description Retrieves a shared listing for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `listingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsListingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    listingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsListingsGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/portals/${encodeURIComponent(portalId)}/listings/${encodeURIComponent(listingId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsListingsGetOutput
    );
  }

  /**
   * @name Create portal listing
   * @description Creates or updates the shared listing for one target on a portal. A portal has at most one listing per target.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsListingsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsListingsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsListingsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsListingsCreateOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/portals/${encodeURIComponent(portalId)}/listings`;

    let request = {
      path,
      body: mapDashboardInstancePortalsListingsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsListingsCreateOutput
    );
  }

  /**
   * @name Update portal listing
   * @description Updates a portal listing. Omitted fields keep their current value.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `listingId` - string
   * @param `body` - DashboardInstancePortalsListingsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsListingsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    listingId: string,
    body: DashboardInstancePortalsListingsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsListingsUpdateOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/portals/${encodeURIComponent(portalId)}/listings/${encodeURIComponent(listingId)}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsListingsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsListingsUpdateOutput
    );
  }

  /**
   * @name Delete portal listing
   * @description Deletes a portal listing and all consumer access attached to it.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `listingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsListingsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    listingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsListingsDeleteOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/portals/${encodeURIComponent(portalId)}/listings/${encodeURIComponent(listingId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsListingsDeleteOutput
    );
  }
}
