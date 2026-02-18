import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsTeamsRolesCreateBody,
  mapDashboardOrganizationsTeamsRolesCreateOutput,
  mapDashboardOrganizationsTeamsRolesGetOutput,
  mapDashboardOrganizationsTeamsRolesListOutput,
  mapDashboardOrganizationsTeamsRolesListQuery,
  mapDashboardOrganizationsTeamsRolesUpdateBody,
  mapDashboardOrganizationsTeamsRolesUpdateOutput,
  type DashboardOrganizationsTeamsRolesCreateBody,
  type DashboardOrganizationsTeamsRolesCreateOutput,
  type DashboardOrganizationsTeamsRolesGetOutput,
  type DashboardOrganizationsTeamsRolesListOutput,
  type DashboardOrganizationsTeamsRolesListQuery,
  type DashboardOrganizationsTeamsRolesUpdateBody,
  type DashboardOrganizationsTeamsRolesUpdateOutput
} from '../resources';

/**
 * @name Organization Team controller
 * @description Read and write team information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationTeamsRolesEndpoint {
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
   * @name List organization teams
   * @description List all organization teams
   *
   * @param `query` - DashboardOrganizationsTeamsRolesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsRolesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsTeamsRolesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsRolesListOutput> {
    let path = 'organization/team-roles';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsTeamsRolesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsTeamsRolesListOutput
    );
  }

  /**
   * @name Get team
   * @description Get the information of a specific team
   *
   * @param `teamRoleId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsRolesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    teamRoleId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsRolesGetOutput> {
    let path = `organization/team-roles/${teamRoleId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsTeamsRolesGetOutput
    );
  }

  /**
   * @name Update team
   * @description Update the role of an team
   *
   * @param `teamRoleId` - string
   * @param `body` - DashboardOrganizationsTeamsRolesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsRolesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    teamRoleId: string,
    body: DashboardOrganizationsTeamsRolesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsRolesUpdateOutput> {
    let path = `organization/team-roles/${teamRoleId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsRolesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsTeamsRolesUpdateOutput
    );
  }

  /**
   * @name Create organization team
   * @description Create a new organization team
   *
   * @param `body` - DashboardOrganizationsTeamsRolesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsRolesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsTeamsRolesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsRolesCreateOutput> {
    let path = 'organization/team-roles';

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsRolesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsTeamsRolesCreateOutput
    );
  }
}
