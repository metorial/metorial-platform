import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsItemsCreateBody,
  mapDashboardInstanceSkillsItemsCreateOutput,
  mapDashboardInstanceSkillsItemsDeleteOutput,
  mapDashboardInstanceSkillsItemsGetOutput,
  mapDashboardInstanceSkillsItemsListOutput,
  mapDashboardInstanceSkillsItemsListQuery,
  type DashboardInstanceSkillsItemsCreateBody,
  type DashboardInstanceSkillsItemsCreateOutput,
  type DashboardInstanceSkillsItemsDeleteOutput,
  type DashboardInstanceSkillsItemsGetOutput,
  type DashboardInstanceSkillsItemsListOutput,
  type DashboardInstanceSkillsItemsListQuery
} from '../resources';

/**
 * @name Skill Items controller
 * @description Skill items attach integrations and providers to skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillsItemsEndpoint {
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
   * @name List skill items
   * @description Returns a paginated list of items for a skill.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `query` - DashboardInstanceSkillsItemsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsItemsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    skillId: string,
    query?: DashboardInstanceSkillsItemsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsItemsListOutput> {
    let path = `instances/${instanceId}/skills/${skillId}/items`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsItemsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsItemsListOutput
    );
  }

  /**
   * @name Get skill item
   * @description Retrieves a specific skill item.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `skillItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsItemsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillId: string,
    skillItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsItemsGetOutput> {
    let path = `instances/${instanceId}/skills/${skillId}/items/${skillItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsItemsGetOutput
    );
  }

  /**
   * @name Create skill item
   * @description Creates a new item on a skill.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsItemsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsItemsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    skillId: string,
    body: DashboardInstanceSkillsItemsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsItemsCreateOutput> {
    let path = `instances/${instanceId}/skills/${skillId}/items`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsItemsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsItemsCreateOutput
    );
  }

  /**
   * @name Delete skill item
   * @description Archives a skill item.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `skillItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsItemsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillId: string,
    skillItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsItemsDeleteOutput> {
    let path = `instances/${instanceId}/skills/${skillId}/items/${skillItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsItemsDeleteOutput
    );
  }
}
