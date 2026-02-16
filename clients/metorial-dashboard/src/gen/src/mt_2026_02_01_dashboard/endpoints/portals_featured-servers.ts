import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsFeaturedServersAddListingBody,
  mapDashboardInstancePortalsFeaturedServersAddListingOutput,
  mapDashboardInstancePortalsFeaturedServersGetOutput,
  mapDashboardInstancePortalsFeaturedServersListOutput,
  mapDashboardInstancePortalsFeaturedServersListQuery,
  mapDashboardInstancePortalsFeaturedServersRemoveListingBody,
  mapDashboardInstancePortalsFeaturedServersRemoveListingOutput,
  type DashboardInstancePortalsFeaturedServersAddListingBody,
  type DashboardInstancePortalsFeaturedServersAddListingOutput,
  type DashboardInstancePortalsFeaturedServersGetOutput,
  type DashboardInstancePortalsFeaturedServersListOutput,
  type DashboardInstancePortalsFeaturedServersListQuery,
  type DashboardInstancePortalsFeaturedServersRemoveListingBody,
  type DashboardInstancePortalsFeaturedServersRemoveListingOutput
} from '../resources';

/**
 * @name Portal Featured Servers controller
 * @description Connect Magic MCP Groups to Portals to control access to your marketplaces.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialPortalsFeaturedServersEndpoint {
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
   * @param `query` - DashboardInstancePortalsFeaturedServersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsFeaturedServersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    portalId: string,
    query?: DashboardInstancePortalsFeaturedServersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsFeaturedServersListOutput> {
    let path = `portals/${portalId}/featured-servers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsFeaturedServersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsFeaturedServersListOutput
    );
  }

  /**
   * @name Get Portal Consumer Server Request by ID
   * @description Retrieves details for a specific portal by its ID.
   *
   * @param `portalId` - string
   * @param `serverListingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsFeaturedServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    portalId: string,
    serverListingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsFeaturedServersGetOutput> {
    let path = `portals/${portalId}/featured-servers/${serverListingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsFeaturedServersGetOutput
    );
  }

  /**
   * @name Create Portal Consumer Server Request
   * @description Creates a new sso tenant for the instance.
   *
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsFeaturedServersAddListingBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsFeaturedServersAddListingOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  addListing(
    portalId: string,
    body: DashboardInstancePortalsFeaturedServersAddListingBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsFeaturedServersAddListingOutput> {
    let path = `portals/${portalId}/featured-servers/add-listing`;

    let request = {
      path,
      body: mapDashboardInstancePortalsFeaturedServersAddListingBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsFeaturedServersAddListingOutput
    );
  }

  /**
   * @name Remove Portal Consumer Server Request
   * @description Removes a server from the featured servers collection.
   *
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsFeaturedServersRemoveListingBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsFeaturedServersRemoveListingOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  removeListing(
    portalId: string,
    body: DashboardInstancePortalsFeaturedServersRemoveListingBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsFeaturedServersRemoveListingOutput> {
    let path = `portals/${portalId}/featured-servers/remove-listing`;

    let request = {
      path,
      body: mapDashboardInstancePortalsFeaturedServersRemoveListingBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsFeaturedServersRemoveListingOutput
    );
  }
}
