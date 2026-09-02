import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOutpostsCreateBody,
  mapDashboardOrganizationsOutpostsCreateOutput,
  mapDashboardOrganizationsOutpostsDeleteOutput,
  mapDashboardOrganizationsOutpostsDisableOutput,
  mapDashboardOrganizationsOutpostsEnableOutput,
  mapDashboardOrganizationsOutpostsGetOutput,
  mapDashboardOrganizationsOutpostsListOutput,
  mapDashboardOrganizationsOutpostsListQuery,
  mapDashboardOrganizationsOutpostsUpdateBody,
  mapDashboardOrganizationsOutpostsUpdateOutput,
  type DashboardOrganizationsOutpostsCreateBody,
  type DashboardOrganizationsOutpostsCreateOutput,
  type DashboardOrganizationsOutpostsDeleteOutput,
  type DashboardOrganizationsOutpostsDisableOutput,
  type DashboardOrganizationsOutpostsEnableOutput,
  type DashboardOrganizationsOutpostsGetOutput,
  type DashboardOrganizationsOutpostsListOutput,
  type DashboardOrganizationsOutpostsListQuery,
  type DashboardOrganizationsOutpostsUpdateBody,
  type DashboardOrganizationsOutpostsUpdateOutput
} from '../resources';

/**
 * @name Outpost controller
 * @description Read and write outposts, their access grants, and credentials
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsOutpostsEndpoint {
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
   * @name List outposts
   * @description List every outpost in the organization’s account family
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsOutpostsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsOutpostsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsListOutput> {
    let path = `dashboard/organizations/${organizationId}/outposts`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOutpostsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOutpostsListOutput
    );
  }

  /**
   * @name Get outpost
   * @description Get any outpost in the organization’s account family
   *
   * @param `organizationId` - string
   * @param `outpostId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    outpostId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/outposts/${outpostId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOutpostsGetOutput
    );
  }

  /**
   * @name Create outpost
   * @description Create a new outpost owned by this organization
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsOutpostsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsOutpostsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/outposts`;

    let request = {
      path,
      body: mapDashboardOrganizationsOutpostsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOutpostsCreateOutput
    );
  }

  /**
   * @name Update outpost
   * @description Update the information of an outpost owned by this organization
   *
   * @param `organizationId` - string
   * @param `outpostId` - string
   * @param `body` - DashboardOrganizationsOutpostsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    outpostId: string,
    body: DashboardOrganizationsOutpostsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/outposts/${outpostId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsOutpostsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOutpostsUpdateOutput
    );
  }

  /**
   * @name Disable outpost
   * @description Disable an outpost owned by this organization. An outpost must be disabled before it can be deleted.
   *
   * @param `organizationId` - string
   * @param `outpostId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsDisableOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  disable(
    organizationId: string,
    outpostId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsDisableOutput> {
    let path = `dashboard/organizations/${organizationId}/outposts/${outpostId}/disable`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOutpostsDisableOutput
    );
  }

  /**
   * @name Enable outpost
   * @description Enable a disabled outpost owned by this organization
   *
   * @param `organizationId` - string
   * @param `outpostId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsEnableOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  enable(
    organizationId: string,
    outpostId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsEnableOutput> {
    let path = `dashboard/organizations/${organizationId}/outposts/${outpostId}/enable`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOutpostsEnableOutput
    );
  }

  /**
   * @name Delete outpost
   * @description Delete a disabled outpost owned by this organization
   *
   * @param `organizationId` - string
   * @param `outpostId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    outpostId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/outposts/${outpostId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsOutpostsDeleteOutput
    );
  }
}
