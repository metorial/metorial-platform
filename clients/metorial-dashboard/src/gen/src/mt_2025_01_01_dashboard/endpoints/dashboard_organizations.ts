import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsCreateBody,
  mapDashboardOrganizationsCreateOutput,
  mapDashboardOrganizationsDeleteOutput,
  mapDashboardOrganizationsGetMembershipOutput,
  mapDashboardOrganizationsGetOutput,
  mapDashboardOrganizationsListOutput,
  mapDashboardOrganizationsListQuery,
  mapDashboardOrganizationsUpdateBody,
  mapDashboardOrganizationsUpdateOutput,
  type DashboardOrganizationsCreateBody,
  type DashboardOrganizationsCreateOutput,
  type DashboardOrganizationsDeleteOutput,
  type DashboardOrganizationsGetMembershipOutput,
  type DashboardOrganizationsGetOutput,
  type DashboardOrganizationsListOutput,
  type DashboardOrganizationsListQuery,
  type DashboardOrganizationsUpdateBody,
  type DashboardOrganizationsUpdateOutput
} from '../resources';

/**
 * @name Organization controller
 * @description Read and write organization information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsEndpoint {
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
   * @name Create organization
   * @description Create a new organization
   *
   * @param `body` - DashboardOrganizationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsCreateOutput> {
    let path = 'dashboard/organizations';

    let request = {
      path,
      body: mapDashboardOrganizationsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardOrganizationsCreateOutput);
  }

  /**
   * @name List organizations
   * @description List all organizations
   *
   * @param `query` - DashboardOrganizationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsListOutput> {
    let path = 'dashboard/organizations';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardOrganizationsListOutput);
  }

  /**
   * @name Get organization
   * @description Get the current organization information
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsGetOutput> {
    let path = `dashboard/organizations/${organizationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardOrganizationsGetOutput);
  }

  /**
   * @name Update organization
   * @description Update the current organization information
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    body: DashboardOrganizationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsUpdateOutput
    );
  }

  /**
   * @name Delete organization
   * @description Delete the current organization
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsDeleteOutput
    );
  }

  /**
   * @name Get organization
   * @description Get the current organization information
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsGetMembershipOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getMembership(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsGetMembershipOutput> {
    let path = `dashboard/organizations/${organizationId}/membership`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsGetMembershipOutput
    );
  }
}
