import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsGroupsCreateBody,
  mapDashboardInstanceSkillsGroupsCreateOutput,
  mapDashboardInstanceSkillsGroupsDeleteOutput,
  mapDashboardInstanceSkillsGroupsGetOutput,
  mapDashboardInstanceSkillsGroupsListOutput,
  mapDashboardInstanceSkillsGroupsListQuery,
  mapDashboardInstanceSkillsGroupsUpdateBody,
  mapDashboardInstanceSkillsGroupsUpdateOutput,
  type DashboardInstanceSkillsGroupsCreateBody,
  type DashboardInstanceSkillsGroupsCreateOutput,
  type DashboardInstanceSkillsGroupsDeleteOutput,
  type DashboardInstanceSkillsGroupsGetOutput,
  type DashboardInstanceSkillsGroupsListOutput,
  type DashboardInstanceSkillsGroupsListQuery,
  type DashboardInstanceSkillsGroupsUpdateBody,
  type DashboardInstanceSkillsGroupsUpdateOutput
} from '../resources';

/**
 * @name Skill Groups controller
 * @description Skill groups organize skills into reusable collections.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsGroupsEndpoint {
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
   * @name List skill groups
   * @description Returns a paginated list of skill groups.
   *
   * @param `query` - DashboardInstanceSkillsGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSkillsGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsListOutput> {
    let path = 'skill-groups';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsGroupsListOutput
    );
  }

  /**
   * @name Get skill group
   * @description Retrieves a specific skill group.
   *
   * @param `skillGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsGetOutput> {
    let path = `skill-groups/${skillGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsGroupsGetOutput
    );
  }

  /**
   * @name Create skill group
   * @description Creates a skill group.
   *
   * @param `body` - DashboardInstanceSkillsGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSkillsGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsCreateOutput> {
    let path = 'skill-groups';

    let request = {
      path,
      body: mapDashboardInstanceSkillsGroupsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsGroupsCreateOutput
    );
  }

  /**
   * @name Update skill group
   * @description Updates a skill group.
   *
   * @param `skillGroupId` - string
   * @param `body` - DashboardInstanceSkillsGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    skillGroupId: string,
    body: DashboardInstanceSkillsGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsUpdateOutput> {
    let path = `skill-groups/${skillGroupId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsGroupsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsGroupsUpdateOutput
    );
  }

  /**
   * @name Delete skill group
   * @description Archives a skill group.
   *
   * @param `skillGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    skillGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsDeleteOutput> {
    let path = `skill-groups/${skillGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsGroupsDeleteOutput
    );
  }
}
