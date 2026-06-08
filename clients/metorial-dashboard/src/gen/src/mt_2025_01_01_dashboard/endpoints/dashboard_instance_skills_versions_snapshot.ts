import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsVersionsSnapshotGetOutput,
  type DashboardInstanceSkillsVersionsSnapshotGetOutput
} from '../resources';

/**
 * @name Skill Versions controller
 * @description Inspect version history and snapshots for a skill.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillsVersionsSnapshotEndpoint {
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
   * @name Get skill version snapshot
   * @description Retrieves the store-backed snapshot for a specific skill version.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `skillVersionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsVersionsSnapshotGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillId: string,
    skillVersionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsVersionsSnapshotGetOutput> {
    let path = `dashboard/instances/${instanceId}/skills/${skillId}/versions/${skillVersionId}/snapshot`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsVersionsSnapshotGetOutput
    );
  }
}
