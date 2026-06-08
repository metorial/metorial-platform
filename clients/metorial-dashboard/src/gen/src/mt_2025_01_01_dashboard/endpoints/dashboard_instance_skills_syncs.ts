import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsSyncsGetOutput,
  mapDashboardInstanceSkillsSyncsListOutput,
  mapDashboardInstanceSkillsSyncsListQuery,
  type DashboardInstanceSkillsSyncsGetOutput,
  type DashboardInstanceSkillsSyncsListOutput,
  type DashboardInstanceSkillsSyncsListQuery
} from '../resources';

/**
 * @name Skill Syncs controller
 * @description View skill plugin and marketplace syncs for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillsSyncsEndpoint {
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
   * @name List skill syncs
   * @description Returns a paginated list of skill syncs.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSkillsSyncsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSyncsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSkillsSyncsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSyncsListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-syncs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsSyncsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsSyncsListOutput
    );
  }

  /**
   * @name Get skill sync
   * @description Retrieves a skill sync.
   *
   * @param `instanceId` - string
   * @param `skillSyncId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsSyncsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillSyncId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsSyncsGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-syncs/${skillSyncId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsSyncsGetOutput
    );
  }
}
