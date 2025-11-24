import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsMembersDeleteOutput,
  mapDashboardOrganizationsMembersGetOutput,
  mapDashboardOrganizationsMembersListOutput,
  mapDashboardOrganizationsMembersListQuery,
  mapDashboardOrganizationsMembersUpdateBody,
  mapDashboardOrganizationsMembersUpdateOutput,
  type DashboardOrganizationsMembersDeleteOutput,
  type DashboardOrganizationsMembersGetOutput,
  type DashboardOrganizationsMembersListOutput,
  type DashboardOrganizationsMembersListQuery,
  type DashboardOrganizationsMembersUpdateBody,
  type DashboardOrganizationsMembersUpdateOutput
} from '../resources';

/**
 * @name Organization Member controller
 * @description Read and write organization member information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationMembersEndpoint {
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
   * @name List organization members
   * @description List all organization members
   *
   * @param `query` - DashboardOrganizationsMembersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsMembersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsMembersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsMembersListOutput> {
    let path = 'organization/members';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsMembersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsMembersListOutput
    );
  }

  /**
   * @name Get organization member
   * @description Get the information of a specific organization member
   *
   * @param `memberId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsMembersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    memberId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsMembersGetOutput> {
    let path = `organization/members/${memberId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsMembersGetOutput
    );
  }

  /**
   * @name Delete organization member
   * @description Remove an organization member
   *
   * @param `memberId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsMembersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    memberId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsMembersDeleteOutput> {
    let path = `organization/members/${memberId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsMembersDeleteOutput
    );
  }

  /**
   * @name Update organization member
   * @description Update the role of an organization member
   *
   * @param `memberId` - string
   * @param `body` - DashboardOrganizationsMembersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsMembersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    memberId: string,
    body: DashboardOrganizationsMembersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsMembersUpdateOutput> {
    let path = `organization/members/${memberId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsMembersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsMembersUpdateOutput
    );
  }
}
