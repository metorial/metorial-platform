import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsGroupsItemsCreateBody,
  mapDashboardInstanceSkillsGroupsItemsCreateOutput,
  mapDashboardInstanceSkillsGroupsItemsDeleteOutput,
  mapDashboardInstanceSkillsGroupsItemsGetOutput,
  mapDashboardInstanceSkillsGroupsItemsListOutput,
  mapDashboardInstanceSkillsGroupsItemsListQuery,
  type DashboardInstanceSkillsGroupsItemsCreateBody,
  type DashboardInstanceSkillsGroupsItemsCreateOutput,
  type DashboardInstanceSkillsGroupsItemsDeleteOutput,
  type DashboardInstanceSkillsGroupsItemsGetOutput,
  type DashboardInstanceSkillsGroupsItemsListOutput,
  type DashboardInstanceSkillsGroupsItemsListQuery
} from '../resources';

/**
 * @name Skill Group Items controller
 * @description Skill group items link groups to skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsGroupsItemsEndpoint {
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
   * @name List skill group items
   * @description Returns a paginated list of items for a skill group.
   *
   * @param `skillGroupId` - string
   * @param `query` - DashboardInstanceSkillsGroupsItemsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsItemsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillGroupId: string,
    query?: DashboardInstanceSkillsGroupsItemsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsItemsListOutput> {
    let path = `skill-groups/${skillGroupId}/items`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsGroupsItemsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsGroupsItemsListOutput
    );
  }

  /**
   * @name Get skill group item
   * @description Retrieves a specific skill group item.
   *
   * @param `skillGroupId` - string
   * @param `skillGroupItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsItemsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillGroupId: string,
    skillGroupItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsItemsGetOutput> {
    let path = `skill-groups/${skillGroupId}/items/${skillGroupItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsGroupsItemsGetOutput
    );
  }

  /**
   * @name Create skill group item
   * @description Adds a skill to a skill group.
   *
   * @param `skillGroupId` - string
   * @param `body` - DashboardInstanceSkillsGroupsItemsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsItemsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    skillGroupId: string,
    body: DashboardInstanceSkillsGroupsItemsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsItemsCreateOutput> {
    let path = `skill-groups/${skillGroupId}/items`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsGroupsItemsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsGroupsItemsCreateOutput
    );
  }

  /**
   * @name Delete skill group item
   * @description Archives a skill group item.
   *
   * @param `skillGroupId` - string
   * @param `skillGroupItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGroupsItemsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    skillGroupId: string,
    skillGroupItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGroupsItemsDeleteOutput> {
    let path = `skill-groups/${skillGroupId}/items/${skillGroupItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsGroupsItemsDeleteOutput
    );
  }
}
