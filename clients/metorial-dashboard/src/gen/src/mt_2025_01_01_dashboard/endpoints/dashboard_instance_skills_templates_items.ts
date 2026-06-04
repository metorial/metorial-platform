import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsTemplatesItemsCreateBody,
  mapDashboardInstanceSkillsTemplatesItemsCreateOutput,
  mapDashboardInstanceSkillsTemplatesItemsDeleteOutput,
  mapDashboardInstanceSkillsTemplatesItemsGetOutput,
  mapDashboardInstanceSkillsTemplatesItemsListOutput,
  mapDashboardInstanceSkillsTemplatesItemsListQuery,
  type DashboardInstanceSkillsTemplatesItemsCreateBody,
  type DashboardInstanceSkillsTemplatesItemsCreateOutput,
  type DashboardInstanceSkillsTemplatesItemsDeleteOutput,
  type DashboardInstanceSkillsTemplatesItemsGetOutput,
  type DashboardInstanceSkillsTemplatesItemsListOutput,
  type DashboardInstanceSkillsTemplatesItemsListQuery
} from '../resources';

/**
 * @name Skill Template Items controller
 * @description Skill template items link template definitions to provider and integration items.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillsTemplatesItemsEndpoint {
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
   * @name List skill template items
   * @description Returns a paginated list of items for a skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `query` - DashboardInstanceSkillsTemplatesItemsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesItemsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    skillTemplateId: string,
    query?: DashboardInstanceSkillsTemplatesItemsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesItemsListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-templates/${skillTemplateId}/items`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsTemplatesItemsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsTemplatesItemsListOutput
    );
  }

  /**
   * @name Get skill template item
   * @description Retrieves a specific skill template item.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `skillTemplateItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesItemsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillTemplateId: string,
    skillTemplateItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesItemsGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-templates/${skillTemplateId}/items/${skillTemplateItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsTemplatesItemsGetOutput
    );
  }

  /**
   * @name Create skill template item
   * @description Adds a provider or integration item to a skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `body` - DashboardInstanceSkillsTemplatesItemsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesItemsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    skillTemplateId: string,
    body: DashboardInstanceSkillsTemplatesItemsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesItemsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-templates/${skillTemplateId}/items`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsTemplatesItemsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsTemplatesItemsCreateOutput
    );
  }

  /**
   * @name Delete skill template item
   * @description Deletes a skill template item.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `skillTemplateItemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesItemsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillTemplateId: string,
    skillTemplateItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesItemsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/skill-templates/${skillTemplateId}/items/${skillTemplateItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsTemplatesItemsDeleteOutput
    );
  }
}
