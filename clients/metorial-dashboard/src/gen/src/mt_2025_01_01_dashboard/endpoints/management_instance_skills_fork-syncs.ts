import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsForkSyncsCreateBody,
  mapDashboardInstanceSkillsForkSyncsCreateOutput,
  mapDashboardInstanceSkillsForkSyncsGetOutput,
  type DashboardInstanceSkillsForkSyncsCreateBody,
  type DashboardInstanceSkillsForkSyncsCreateOutput,
  type DashboardInstanceSkillsForkSyncsGetOutput
} from '../resources';

/**
 * @name Skill Fork Syncs controller
 * @description Synchronize changes from an upstream skill into a fork.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillsForkSyncsEndpoint {
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
   * @name Create skill fork sync
   * @description Queues synchronization of upstream changes into a forked skill.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSkillsForkSyncsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsForkSyncsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSkillsForkSyncsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsForkSyncsCreateOutput> {
    let path = `instances/${instanceId}/skill-fork-syncs`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsForkSyncsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsForkSyncsCreateOutput
    );
  }

  /**
   * @name Get skill fork sync
   * @description Retrieves the state of a fork synchronization.
   *
   * @param `instanceId` - string
   * @param `skillForkSyncId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsForkSyncsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillForkSyncId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsForkSyncsGetOutput> {
    let path = `instances/${instanceId}/skill-fork-syncs/${skillForkSyncId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsForkSyncsGetOutput
    );
  }
}
