import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsTeamsMembersCreateBody,
  mapDashboardOrganizationsTeamsMembersCreateOutput,
  mapDashboardOrganizationsTeamsMembersDeleteOutput,
  type DashboardOrganizationsTeamsMembersCreateBody,
  type DashboardOrganizationsTeamsMembersCreateOutput,
  type DashboardOrganizationsTeamsMembersDeleteOutput
} from '../resources';

/**
 * @name Organization Team controller
 * @description Read and write team information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsTeamsMembersEndpoint {
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
   * @name Assign member to team
   * @description Assign an organization member to a team
   *
   * @param `organizationId` - string
   * @param `teamId` - string
   * @param `body` - DashboardOrganizationsTeamsMembersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsMembersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    teamId: string,
    body: DashboardOrganizationsTeamsMembersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsMembersCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/teams/${teamId}/members`;

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsMembersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardOrganizationsTeamsMembersCreateOutput);
  }

  /**
   * @name Remove member from team
   * @description Remove an organization member from a team
   *
   * @param `organizationId` - string
   * @param `teamId` - string
   * @param `actorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsMembersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    teamId: string,
    actorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsMembersDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/teams/${teamId}/members/${actorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapDashboardOrganizationsTeamsMembersDeleteOutput);
  }
}
