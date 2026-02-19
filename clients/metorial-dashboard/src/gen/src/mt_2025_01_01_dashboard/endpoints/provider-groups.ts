import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderGroupsAddListingBody,
  mapDashboardInstanceProviderGroupsAddListingOutput,
  mapDashboardInstanceProviderGroupsCreateBody,
  mapDashboardInstanceProviderGroupsCreateOutput,
  mapDashboardInstanceProviderGroupsGetOutput,
  mapDashboardInstanceProviderGroupsListOutput,
  mapDashboardInstanceProviderGroupsListQuery,
  mapDashboardInstanceProviderGroupsRemoveListingOutput,
  mapDashboardInstanceProviderGroupsUpdateBody,
  mapDashboardInstanceProviderGroupsUpdateOutput,
  type DashboardInstanceProviderGroupsAddListingBody,
  type DashboardInstanceProviderGroupsAddListingOutput,
  type DashboardInstanceProviderGroupsCreateBody,
  type DashboardInstanceProviderGroupsCreateOutput,
  type DashboardInstanceProviderGroupsGetOutput,
  type DashboardInstanceProviderGroupsListOutput,
  type DashboardInstanceProviderGroupsListQuery,
  type DashboardInstanceProviderGroupsRemoveListingOutput,
  type DashboardInstanceProviderGroupsUpdateBody,
  type DashboardInstanceProviderGroupsUpdateOutput
} from '../resources';

/**
 * @name Provider Groups controller
 * @description A group is a user-defined custom folder for organizing providers in your instance like 'Sales Tools' or 'Engineering'.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderGroupsEndpoint {
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
   * @name List provider groups
   * @description Returns a paginated list of provider groups.
   *
   * @param `query` - DashboardInstanceProviderGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderGroupsListOutput> {
    let path = 'provider-groups';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceProviderGroupsListOutput);
  }

  /**
   * @name Get provider group
   * @description Retrieves a specific provider group by ID.
   *
   * @param `providerGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderGroupsGetOutput> {
    let path = `provider-groups/${providerGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceProviderGroupsGetOutput);
  }

  /**
   * @name Create provider group
   * @description Creates a new custom provider group.
   *
   * @param `body` - DashboardInstanceProviderGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProviderGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderGroupsCreateOutput> {
    let path = 'provider-groups';

    let request = {
      path,
      body: mapDashboardInstanceProviderGroupsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceProviderGroupsCreateOutput);
  }

  /**
   * @name Update provider group
   * @description Updates an existing provider group.
   *
   * @param `providerGroupId` - string
   * @param `body` - DashboardInstanceProviderGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    providerGroupId: string,
    body: DashboardInstanceProviderGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderGroupsUpdateOutput> {
    let path = `provider-groups/${providerGroupId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderGroupsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceProviderGroupsUpdateOutput);
  }

  /**
   * @name Add listing to group
   * @description Adds a provider listing to a group.
   *
   * @param `providerGroupId` - string
   * @param `body` - DashboardInstanceProviderGroupsAddListingBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderGroupsAddListingOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  addListing(
    providerGroupId: string,
    body: DashboardInstanceProviderGroupsAddListingBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderGroupsAddListingOutput> {
    let path = `provider-groups/${providerGroupId}/listings`;

    let request = {
      path,
      body: mapDashboardInstanceProviderGroupsAddListingBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceProviderGroupsAddListingOutput);
  }

  /**
   * @name Remove listing from group
   * @description Removes a provider listing from a group.
   *
   * @param `providerGroupId` - string
   * @param `providerListingId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderGroupsRemoveListingOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  removeListing(
    providerGroupId: string,
    providerListingId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderGroupsRemoveListingOutput> {
    let path = `provider-groups/${providerGroupId}/listings/${providerListingId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderGroupsRemoveListingOutput
    );
  }
}
