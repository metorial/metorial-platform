import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsTeamsProjectsRemoveOutput,
  mapDashboardOrganizationsTeamsProjectsSetBody,
  mapDashboardOrganizationsTeamsProjectsSetOutput,
  type DashboardOrganizationsTeamsProjectsRemoveOutput,
  type DashboardOrganizationsTeamsProjectsSetBody,
  type DashboardOrganizationsTeamsProjectsSetOutput
} from '../resources';

/**
 * @name Organization Team controller
 * @description Read and write team information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationTeamsProjectsEndpoint {
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
   * @name Set team projects
   * @description Set the projects assigned to a team
   *
   * @param `teamId` - string
   * @param `body` - DashboardOrganizationsTeamsProjectsSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsProjectsSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    teamId: string,
    body: DashboardOrganizationsTeamsProjectsSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsProjectsSetOutput> {
    let path = `organization/teams/${teamId}/projects`;

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsProjectsSetBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardOrganizationsTeamsProjectsSetOutput);
  }

  /**
   * @name Remove team project
   * @description Remove a project from a team
   *
   * @param `teamId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsProjectsRemoveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  remove(
    teamId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsProjectsRemoveOutput> {
    let path = `organization/teams/${teamId}/projects/${projectId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapDashboardOrganizationsTeamsProjectsRemoveOutput);
  }
}
