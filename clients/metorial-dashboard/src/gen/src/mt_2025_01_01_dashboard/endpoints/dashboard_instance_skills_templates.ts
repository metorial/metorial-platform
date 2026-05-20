import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsTemplatesCreateBody,
  mapDashboardInstanceSkillsTemplatesCreateOutput,
  mapDashboardInstanceSkillsTemplatesDeleteOutput,
  mapDashboardInstanceSkillsTemplatesGetOutput,
  mapDashboardInstanceSkillsTemplatesListOutput,
  mapDashboardInstanceSkillsTemplatesListQuery,
  mapDashboardInstanceSkillsTemplatesUpdateBody,
  mapDashboardInstanceSkillsTemplatesUpdateOutput,
  type DashboardInstanceSkillsTemplatesCreateBody,
  type DashboardInstanceSkillsTemplatesCreateOutput,
  type DashboardInstanceSkillsTemplatesDeleteOutput,
  type DashboardInstanceSkillsTemplatesGetOutput,
  type DashboardInstanceSkillsTemplatesListOutput,
  type DashboardInstanceSkillsTemplatesListQuery,
  type DashboardInstanceSkillsTemplatesUpdateBody,
  type DashboardInstanceSkillsTemplatesUpdateOutput
} from '../resources';

/**
 * @name Skill Templates controller
 * @description Skill templates define reusable starting points for skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillsTemplatesEndpoint {
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
   * @param `query` - DashboardInstanceSkillsTemplatesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSkillsTemplatesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsTemplatesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsTemplatesListOutput
    );
  }

  /**
   * @name Get skill template
   * @description Retrieves a specific skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template/${skillTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsTemplatesGetOutput
    );
  }

  /**
   * @name Create skill template
   * @description Creates a skill template.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSkillsTemplatesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSkillsTemplatesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsTemplatesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsTemplatesCreateOutput
    );
  }

  /**
   * @name Update skill template
   * @description Updates a skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `body` - DashboardInstanceSkillsTemplatesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    skillTemplateId: string,
    body: DashboardInstanceSkillsTemplatesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template/${skillTemplateId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsTemplatesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsTemplatesUpdateOutput
    );
  }

  /**
   * @name Delete skill template
   * @description Archives a skill template.
   *
   * @param `instanceId` - string
   * @param `skillTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsTemplatesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsTemplatesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/skill-template/${skillTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsTemplatesDeleteOutput
    );
  }
}
