import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsSurfaceProviderGroupsAddListingBody,
  mapDashboardInstancePortalsSurfaceProviderGroupsAddListingOutput,
  mapDashboardInstancePortalsSurfaceProviderGroupsCreateBody,
  mapDashboardInstancePortalsSurfaceProviderGroupsCreateOutput,
  mapDashboardInstancePortalsSurfaceProviderGroupsDeleteOutput,
  mapDashboardInstancePortalsSurfaceProviderGroupsGetOutput,
  mapDashboardInstancePortalsSurfaceProviderGroupsListOutput,
  mapDashboardInstancePortalsSurfaceProviderGroupsListQuery,
  mapDashboardInstancePortalsSurfaceProviderGroupsRemoveListingOutput,
  mapDashboardInstancePortalsSurfaceProviderGroupsUpdateBody,
  mapDashboardInstancePortalsSurfaceProviderGroupsUpdateOutput,
  type DashboardInstancePortalsSurfaceProviderGroupsAddListingBody,
  type DashboardInstancePortalsSurfaceProviderGroupsAddListingOutput,
  type DashboardInstancePortalsSurfaceProviderGroupsCreateBody,
  type DashboardInstancePortalsSurfaceProviderGroupsCreateOutput,
  type DashboardInstancePortalsSurfaceProviderGroupsDeleteOutput,
  type DashboardInstancePortalsSurfaceProviderGroupsGetOutput,
  type DashboardInstancePortalsSurfaceProviderGroupsListOutput,
  type DashboardInstancePortalsSurfaceProviderGroupsListQuery,
  type DashboardInstancePortalsSurfaceProviderGroupsRemoveListingOutput,
  type DashboardInstancePortalsSurfaceProviderGroupsUpdateBody,
  type DashboardInstancePortalsSurfaceProviderGroupsUpdateOutput
} from '../resources';

/**
 * @name Portal Consumer Surface Provider Groups controller
 * @description Manage the provider groups linked to a portal consumer surface for organizing providers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePortalsSurfaceProviderGroupsEndpoint {
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
   * @name List portal surface provider groups
   * @description Returns a paginated list of provider groups linked to the portal consumer surface.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsSurfaceProviderGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsSurfaceProviderGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsSurfaceProviderGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsSurfaceProviderGroupsListOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/surface-provider-groups`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsSurfaceProviderGroupsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsSurfaceProviderGroupsListOutput
    );
  }

  /**
   * @name Get portal surface provider group
   * @description Retrieves a portal surface provider group by ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerSurfaceProviderGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsSurfaceProviderGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerSurfaceProviderGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsSurfaceProviderGroupsGetOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/surface-provider-groups/${consumerSurfaceProviderGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsSurfaceProviderGroupsGetOutput
    );
  }

  /**
   * @name Create portal surface provider group
   * @description Creates a new provider group linked to the portal consumer surface.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsSurfaceProviderGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsSurfaceProviderGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsSurfaceProviderGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsSurfaceProviderGroupsCreateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/surface-provider-groups`;

    let request = {
      path,
      body: mapDashboardInstancePortalsSurfaceProviderGroupsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsSurfaceProviderGroupsCreateOutput
    );
  }

  /**
   * @name Update portal surface provider group
   * @description Updates a provider group linked to the portal consumer surface.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerSurfaceProviderGroupId` - string
   * @param `body` - DashboardInstancePortalsSurfaceProviderGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsSurfaceProviderGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    consumerSurfaceProviderGroupId: string,
    body: DashboardInstancePortalsSurfaceProviderGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsSurfaceProviderGroupsUpdateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/surface-provider-groups/${consumerSurfaceProviderGroupId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsSurfaceProviderGroupsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsSurfaceProviderGroupsUpdateOutput
    );
  }

  /**
   * @name Delete portal surface provider group
   * @description Deletes a provider group linked to the portal consumer surface.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerSurfaceProviderGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsSurfaceProviderGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    consumerSurfaceProviderGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsSurfaceProviderGroupsDeleteOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/surface-provider-groups/${consumerSurfaceProviderGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsSurfaceProviderGroupsDeleteOutput
    );
  }

  /**
   * @name Add listing to surface provider group
   * @description Adds a consumer access listing to the surface provider group.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerSurfaceProviderGroupId` - string
   * @param `body` - DashboardInstancePortalsSurfaceProviderGroupsAddListingBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsSurfaceProviderGroupsAddListingOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  addListing(
    instanceId: string,
    portalId: string,
    consumerSurfaceProviderGroupId: string,
    body: DashboardInstancePortalsSurfaceProviderGroupsAddListingBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsSurfaceProviderGroupsAddListingOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/surface-provider-groups/${consumerSurfaceProviderGroupId}/listings`;

    let request = {
      path,
      body: mapDashboardInstancePortalsSurfaceProviderGroupsAddListingBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsSurfaceProviderGroupsAddListingOutput
    );
  }

  /**
   * @name Remove listing from surface provider group
   * @description Removes a consumer access listing from the surface provider group.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerSurfaceProviderGroupId` - string
   * @param `consumerAccessListingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsSurfaceProviderGroupsRemoveListingOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  removeListing(
    instanceId: string,
    portalId: string,
    consumerSurfaceProviderGroupId: string,
    consumerAccessListingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsSurfaceProviderGroupsRemoveListingOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/surface-provider-groups/${consumerSurfaceProviderGroupId}/listings/${consumerAccessListingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsSurfaceProviderGroupsRemoveListingOutput
    );
  }
}
