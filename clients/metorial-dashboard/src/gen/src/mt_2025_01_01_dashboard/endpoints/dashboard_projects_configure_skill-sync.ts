import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureSkillSyncGetOutput,
  mapDashboardProjectsConfigureSkillSyncUpdateBody,
  mapDashboardProjectsConfigureSkillSyncUpdateOutput,
  type DashboardProjectsConfigureSkillSyncGetOutput,
  type DashboardProjectsConfigureSkillSyncUpdateBody,
  type DashboardProjectsConfigureSkillSyncUpdateOutput
} from '../resources';

/**
 * @name Project skill sync configuration controller
 * @description Configure how project skills are synced to repositories
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureSkillSyncEndpoint {
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
   * @name Get project skill sync configuration
   * @description Get the skill sync settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureSkillSyncGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureSkillSyncGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/skill-sync`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureSkillSyncGetOutput
    );
  }

  /**
   * @name Update project skill sync configuration
   * @description Update the skill sync settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureSkillSyncUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureSkillSyncUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureSkillSyncUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureSkillSyncUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/skill-sync`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureSkillSyncUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureSkillSyncUpdateOutput
    );
  }
}
