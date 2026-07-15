import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMergeRequestsPlanGetOutput,
  type DashboardInstanceSkillsMergeRequestsPlanGetOutput
} from '../resources';

/**
 * @name Skill Merge Requests controller
 * @description Review, resolve, and apply changes between skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillsMergeRequestsPlanEndpoint {
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
   * @name Get skill merge plan
   * @description Returns the proposed changes and conflicts for a skill merge request.
   *
   * @param `instanceId` - string
   * @param `skillMergeRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsPlanGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillMergeRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsPlanGetOutput> {
    let path = `instances/${instanceId}/skill-merge-requests/${skillMergeRequestId}/plan`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMergeRequestsPlanGetOutput
    );
  }
}
