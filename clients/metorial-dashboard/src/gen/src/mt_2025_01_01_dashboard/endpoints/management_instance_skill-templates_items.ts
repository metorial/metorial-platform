import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillTemplatesItemsCreateBody,
  mapDashboardInstanceSkillTemplatesItemsCreateOutput,
  mapDashboardInstanceSkillTemplatesItemsDeleteOutput,
  mapDashboardInstanceSkillTemplatesItemsGetOutput,
  mapDashboardInstanceSkillTemplatesItemsListOutput,
  mapDashboardInstanceSkillTemplatesItemsListQuery,
  type DashboardInstanceSkillTemplatesItemsCreateBody,
  type DashboardInstanceSkillTemplatesItemsCreateOutput,
  type DashboardInstanceSkillTemplatesItemsDeleteOutput,
  type DashboardInstanceSkillTemplatesItemsGetOutput,
  type DashboardInstanceSkillTemplatesItemsListOutput,
  type DashboardInstanceSkillTemplatesItemsListQuery
} from '../resources';

/**
 * @name Skill Template Items controller
 * @description Skill template items link template definitions to provider and integration items.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillTemplatesItemsEndpoint {
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
   * @param `query` - DashboardInstanceSkillTemplatesItemsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillTemplatesItemsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    skillTemplateId: string,
    query?: DashboardInstanceSkillTemplatesItemsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesItemsListOutput> {
    let path = `instances/${instanceId}/skill-template/${skillTemplateId}/items`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillTemplatesItemsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillTemplatesItemsListOutput
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
   * @returns DashboardInstanceSkillTemplatesItemsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillTemplateId: string,
    skillTemplateItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesItemsGetOutput> {
    let path = `instances/${instanceId}/skill-template/${skillTemplateId}/items/${skillTemplateItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillTemplatesItemsGetOutput
    );
  }

  /**
   * @name Create skill template item
   * @description Adds a provider or integration item to a skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `body` - DashboardInstanceSkillTemplatesItemsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillTemplatesItemsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    skillTemplateId: string,
    body: DashboardInstanceSkillTemplatesItemsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesItemsCreateOutput> {
    let path = `instances/${instanceId}/skill-template/${skillTemplateId}/items`;

    let request = {
      path,
      body: mapDashboardInstanceSkillTemplatesItemsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillTemplatesItemsCreateOutput
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
   * @returns DashboardInstanceSkillTemplatesItemsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillTemplateId: string,
    skillTemplateItemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesItemsDeleteOutput> {
    let path = `instances/${instanceId}/skill-template/${skillTemplateId}/items/${skillTemplateItemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillTemplatesItemsDeleteOutput
    );
  }
}
