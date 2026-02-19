import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

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
export class MetorialDashboardOrganizationsTeamsEndpoint {
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
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsPermissionsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  permissions(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsPermissionsOutput> {
    let path = `dashboard/organizations/${organizationId}/team-role-permissions`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardOrganizationsTeamsPermissionsOutput);
  }

  /**
   * @name List organization teams
   * @description List all organization teams
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsTeamsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsTeamsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsListOutput> {
    let path = `dashboard/organizations/${organizationId}/teams`;

    let request = {
      path,

      query: query ? mapDashboardOrganizationsTeamsListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardOrganizationsTeamsListOutput);
  }

  /**
   * @name Get team
   * @description Get the information of a specific team
   *
   * @param `organizationId` - string
   * @param `teamId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    teamId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/teams/${teamId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardOrganizationsTeamsGetOutput);
  }

  /**
   * @name Update team
   * @description Update the role of an team
   *
   * @param `organizationId` - string
   * @param `teamId` - string
   * @param `body` - DashboardOrganizationsTeamsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    teamId: string,
    body: DashboardOrganizationsTeamsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/teams/${teamId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardOrganizationsTeamsUpdateOutput);
  }

  /**
   * @name Create organization team
   * @description Create a new organization team
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsTeamsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsTeamsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/teams`;

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardOrganizationsTeamsCreateOutput);
  }
}
