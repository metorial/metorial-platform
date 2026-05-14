import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsVersionsGetOutput,
  mapDashboardInstanceSkillsVersionsListOutput,
  mapDashboardInstanceSkillsVersionsListQuery,
  type DashboardInstanceSkillsVersionsGetOutput,
  type DashboardInstanceSkillsVersionsListOutput,
  type DashboardInstanceSkillsVersionsListQuery
} from '../resources';

/**
 * @name Skill Versions controller
 * @description Inspect version history and snapshots for a skill.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsVersionsEndpoint {
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
   * @name List skill versions
   * @description Returns a paginated list of versions for a specific skill.
   *
   * @param `skillId` - string
   * @param `query` - DashboardInstanceSkillsVersionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsVersionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillId: string,
    query?: DashboardInstanceSkillsVersionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsVersionsListOutput> {
    let path = `skills/${skillId}/versions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsVersionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsVersionsListOutput
    );
  }

  /**
   * @name Get skill version by ID
   * @description Retrieves a specific skill version by its ID.
   *
   * @param `skillId` - string
   * @param `skillVersionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsVersionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillId: string,
    skillVersionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsVersionsGetOutput> {
    let path = `skills/${skillId}/versions/${skillVersionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsVersionsGetOutput
    );
  }
}
