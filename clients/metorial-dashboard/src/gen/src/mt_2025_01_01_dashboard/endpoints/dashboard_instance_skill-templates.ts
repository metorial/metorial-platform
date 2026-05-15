import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillTemplatesCreateBody,
  mapDashboardInstanceSkillTemplatesCreateOutput,
  mapDashboardInstanceSkillTemplatesDeleteOutput,
  mapDashboardInstanceSkillTemplatesGetOutput,
  mapDashboardInstanceSkillTemplatesListOutput,
  mapDashboardInstanceSkillTemplatesListQuery,
  mapDashboardInstanceSkillTemplatesUpdateBody,
  mapDashboardInstanceSkillTemplatesUpdateOutput,
  type DashboardInstanceSkillTemplatesCreateBody,
  type DashboardInstanceSkillTemplatesCreateOutput,
  type DashboardInstanceSkillTemplatesDeleteOutput,
  type DashboardInstanceSkillTemplatesGetOutput,
  type DashboardInstanceSkillTemplatesListOutput,
  type DashboardInstanceSkillTemplatesListQuery,
  type DashboardInstanceSkillTemplatesUpdateBody,
  type DashboardInstanceSkillTemplatesUpdateOutput
} from '../resources';

/**
 * @name Skill Templates controller
 * @description Skill templates define reusable starting points for skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillTemplatesEndpoint {
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
   * @name List skill templates
   * @description Returns a paginated list of skill templates.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSkillTemplatesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillTemplatesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSkillTemplatesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillTemplatesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillTemplatesListOutput
    );
  }

  /**
   * @name Get skill template
   * @description Retrieves a specific skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillTemplatesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template/${skillTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillTemplatesGetOutput
    );
  }

  /**
   * @name Create skill template
   * @description Creates a skill template.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSkillTemplatesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillTemplatesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSkillTemplatesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template`;

    let request = {
      path,
      body: mapDashboardInstanceSkillTemplatesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillTemplatesCreateOutput
    );
  }

  /**
   * @name Update skill template
   * @description Updates a skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `body` - DashboardInstanceSkillTemplatesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillTemplatesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    skillTemplateId: string,
    body: DashboardInstanceSkillTemplatesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template/${skillTemplateId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillTemplatesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillTemplatesUpdateOutput
    );
  }

  /**
   * @name Delete skill template
   * @description Archives a skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillTemplatesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillTemplatesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template/${skillTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillTemplatesDeleteOutput
    );
  }
}
