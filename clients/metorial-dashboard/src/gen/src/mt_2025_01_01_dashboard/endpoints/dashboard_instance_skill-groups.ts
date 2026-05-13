import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillGroupsCreateBody,
  mapDashboardInstanceSkillGroupsCreateOutput,
  mapDashboardInstanceSkillGroupsDeleteOutput,
  mapDashboardInstanceSkillGroupsGetOutput,
  mapDashboardInstanceSkillGroupsListOutput,
  mapDashboardInstanceSkillGroupsListQuery,
  mapDashboardInstanceSkillGroupsUpdateBody,
  mapDashboardInstanceSkillGroupsUpdateOutput,
  type DashboardInstanceSkillGroupsCreateBody,
  type DashboardInstanceSkillGroupsCreateOutput,
  type DashboardInstanceSkillGroupsDeleteOutput,
  type DashboardInstanceSkillGroupsGetOutput,
  type DashboardInstanceSkillGroupsListOutput,
  type DashboardInstanceSkillGroupsListQuery,
  type DashboardInstanceSkillGroupsUpdateBody,
  type DashboardInstanceSkillGroupsUpdateOutput
} from '../resources';

/**
 * @name Skill Groups controller
 * @description Skill groups organize skills into reusable collections.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillGroupsEndpoint {
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
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSkillGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSkillGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-groups`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillGroupsListOutput
    );
  }

  /**
   * @name Get skill group
   * @description Retrieves a specific skill group.
   *
   * @param `instanceId` - string
   * @param `skillGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-groups/${skillGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillGroupsGetOutput
    );
  }

  /**
   * @name Create skill group
   * @description Creates a skill group.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSkillGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSkillGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-groups`;

    let request = {
      path,
      body: mapDashboardInstanceSkillGroupsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillGroupsCreateOutput
    );
  }

  /**
   * @name Update skill group
   * @description Updates a skill group.
   *
   * @param `instanceId` - string
   * @param `skillGroupId` - string
   * @param `body` - DashboardInstanceSkillGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    skillGroupId: string,
    body: DashboardInstanceSkillGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-groups/${skillGroupId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillGroupsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillGroupsUpdateOutput
    );
  }

  /**
   * @name Delete skill group
   * @description Archives a skill group.
   *
   * @param `instanceId` - string
   * @param `skillGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/skill-groups/${skillGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillGroupsDeleteOutput
    );
  }
}
