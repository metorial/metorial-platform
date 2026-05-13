import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerAccessListingsCreateBody,
  mapDashboardInstancePortalsConsumerAccessListingsCreateOutput,
  mapDashboardInstancePortalsConsumerAccessListingsDeleteOutput,
  mapDashboardInstancePortalsConsumerAccessListingsGetOutput,
  mapDashboardInstancePortalsConsumerAccessListingsListOutput,
  mapDashboardInstancePortalsConsumerAccessListingsListQuery,
  mapDashboardInstancePortalsConsumerAccessListingsUpdateBody,
  mapDashboardInstancePortalsConsumerAccessListingsUpdateOutput,
  type DashboardInstancePortalsConsumerAccessListingsCreateBody,
  type DashboardInstancePortalsConsumerAccessListingsCreateOutput,
  type DashboardInstancePortalsConsumerAccessListingsDeleteOutput,
  type DashboardInstancePortalsConsumerAccessListingsGetOutput,
  type DashboardInstancePortalsConsumerAccessListingsListOutput,
  type DashboardInstancePortalsConsumerAccessListingsListQuery,
  type DashboardInstancePortalsConsumerAccessListingsUpdateBody,
  type DashboardInstancePortalsConsumerAccessListingsUpdateOutput
} from '../resources';

/**
 * @name Portal Consumer Access Listings controller
 * @description Read the shared consumer access listings available on a portal surface.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePortalsConsumerAccessListingsEndpoint {
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
   * @name List portal consumer access listings
   * @description Returns a paginated list of shared consumer access listings for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsConsumerAccessListingsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessListingsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsConsumerAccessListingsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessListingsListOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access-listings`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerAccessListingsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAccessListingsListOutput
    );
  }

  /**
   * @name Get portal consumer access listing
   * @description Retrieves one shared consumer access listing for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessListingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessListingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerAccessListingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessListingsGetOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access-listings/${consumerAccessListingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAccessListingsGetOutput
    );
  }

  /**
   * @name Create portal consumer access listing
   * @description Creates a shared consumer access listing for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsConsumerAccessListingsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessListingsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsConsumerAccessListingsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessListingsCreateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access-listings`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerAccessListingsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerAccessListingsCreateOutput
    );
  }

  /**
   * @name Update portal consumer access listing
   * @description Updates listing metadata for a portal consumer access listing.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessListingId` - string
   * @param `body` - DashboardInstancePortalsConsumerAccessListingsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessListingsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    consumerAccessListingId: string,
    body: DashboardInstancePortalsConsumerAccessListingsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessListingsUpdateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access-listings/${consumerAccessListingId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerAccessListingsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsConsumerAccessListingsUpdateOutput
    );
  }

  /**
   * @name Delete portal consumer access listing
   * @description Deletes a portal consumer access listing and all consumer access attached to it.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessListingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessListingsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    consumerAccessListingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessListingsDeleteOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/consumer-access-listings/${consumerAccessListingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsConsumerAccessListingsDeleteOutput
    );
  }
}
