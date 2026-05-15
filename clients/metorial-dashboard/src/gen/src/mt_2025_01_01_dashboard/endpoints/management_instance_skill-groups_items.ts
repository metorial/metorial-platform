import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillGroupsItemsCreateBody,
  mapDashboardInstanceSkillGroupsItemsCreateOutput,
  mapDashboardInstanceSkillGroupsItemsDeleteOutput,
  mapDashboardInstanceSkillGroupsItemsGetOutput,
  mapDashboardInstanceSkillGroupsItemsListOutput,
  mapDashboardInstanceSkillGroupsItemsListQuery,
  type DashboardInstanceSkillGroupsItemsCreateBody,
  type DashboardInstanceSkillGroupsItemsCreateOutput,
  type DashboardInstanceSkillGroupsItemsDeleteOutput,
  type DashboardInstanceSkillGroupsItemsGetOutput,
  type DashboardInstanceSkillGroupsItemsListOutput,
  type DashboardInstanceSkillGroupsItemsListQuery
} from '../resources';

/**
 * @name Skill Group Items controller
 * @description Skill group items link groups to skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillGroupsItemsEndpoint {
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
   * @param `instanceId` - string
   * @param `skillGroupId` - string
   * @param `query` - DashboardInstanceSkillGroupsItemsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsItemsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    skillGroupId: string,
    query?: DashboardInstanceSkillGroupsItemsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsItemsListOutput> {
    let path = `instances/${instanceId}/skill-groups/${skillGroupId}/items`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillGroupsItemsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillGroupsItemsListOutput
    );
  }

  /**
   * @name Get skill group item
   * @description Retrieves a specific skill group item.
   *
   * @param `instanceId` - string
   * @param `skillGroupId` - string
   * @param `skillGroupItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsItemsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillGroupId: string,
    skillGroupItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsItemsGetOutput> {
    let path = `instances/${instanceId}/skill-groups/${skillGroupId}/items/${skillGroupItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillGroupsItemsGetOutput
    );
  }

  /**
   * @name Create skill group item
   * @description Adds a skill to a skill group.
   *
   * @param `instanceId` - string
   * @param `skillGroupId` - string
   * @param `body` - DashboardInstanceSkillGroupsItemsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsItemsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    skillGroupId: string,
    body: DashboardInstanceSkillGroupsItemsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsItemsCreateOutput> {
    let path = `instances/${instanceId}/skill-groups/${skillGroupId}/items`;

    let request = {
      path,
      body: mapDashboardInstanceSkillGroupsItemsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillGroupsItemsCreateOutput
    );
  }

  /**
   * @name Delete skill group item
   * @description Archives a skill group item.
   *
   * @param `instanceId` - string
   * @param `skillGroupId` - string
   * @param `skillGroupItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillGroupsItemsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillGroupId: string,
    skillGroupItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillGroupsItemsDeleteOutput> {
    let path = `instances/${instanceId}/skill-groups/${skillGroupId}/items/${skillGroupItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillGroupsItemsDeleteOutput
    );
  }
}
