import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerAccessListingsGetOutput,
  mapDashboardInstancePortalsConsumerAccessListingsListOutput,
  mapDashboardInstancePortalsConsumerAccessListingsListQuery,
  type DashboardInstancePortalsConsumerAccessListingsGetOutput,
  type DashboardInstancePortalsConsumerAccessListingsListOutput,
  type DashboardInstancePortalsConsumerAccessListingsListQuery
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
}
