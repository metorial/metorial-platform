import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsTeamsCreateBody,
  mapDashboardOrganizationsTeamsCreateOutput,
  mapDashboardOrganizationsTeamsGetOutput,
  mapDashboardOrganizationsTeamsListOutput,
  mapDashboardOrganizationsTeamsListQuery,
  mapDashboardOrganizationsTeamsPermissionsOutput,
  mapDashboardOrganizationsTeamsUpdateBody,
  mapDashboardOrganizationsTeamsUpdateOutput,
  type DashboardOrganizationsTeamsCreateBody,
  type DashboardOrganizationsTeamsCreateOutput,
  type DashboardOrganizationsTeamsGetOutput,
  type DashboardOrganizationsTeamsListOutput,
  type DashboardOrganizationsTeamsListQuery,
  type DashboardOrganizationsTeamsPermissionsOutput,
  type DashboardOrganizationsTeamsUpdateBody,
  type DashboardOrganizationsTeamsUpdateOutput
} from '../resources';

/**
 * @name Organization Team controller
 * @description Read and write team information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationTeamsEndpoint {
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
   * @name Get team
   * @description Get the information of a specific team
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsPermissionsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  permissions(opts?: {
    headers?: Record<string, string>;
  }): Promise<DashboardOrganizationsTeamsPermissionsOutput> {
    let path = 'organization/team-role-permissions';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsTeamsPermissionsOutput
    );
  }

  /**
   * @name List organization teams
   * @description List all organization teams
   *
   * @param `query` - DashboardOrganizationsTeamsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsTeamsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsListOutput> {
    let path = 'organization/teams';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsTeamsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsTeamsListOutput
    );
  }

  /**
   * @name Get team
   * @description Get the information of a specific team
   *
   * @param `teamId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    teamId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsGetOutput> {
    let path = `organization/teams/${teamId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsTeamsGetOutput
    );
  }

  /**
   * @name Update team
   * @description Update the role of an team
   *
   * @param `teamId` - string
   * @param `body` - DashboardOrganizationsTeamsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    teamId: string,
    body: DashboardOrganizationsTeamsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsUpdateOutput> {
    let path = `organization/teams/${teamId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsTeamsUpdateOutput
    );
  }

  /**
   * @name Create organization team
   * @description Create a new organization team
   *
   * @param `body` - DashboardOrganizationsTeamsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsTeamsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsCreateOutput> {
    let path = 'organization/teams';

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsTeamsCreateOutput
    );
  }
}
