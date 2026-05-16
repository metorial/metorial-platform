import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsPluginsSkillsAddBody,
  mapDashboardInstanceSkillsPluginsSkillsAddOutput,
  mapDashboardInstanceSkillsPluginsSkillsGetOutput,
  mapDashboardInstanceSkillsPluginsSkillsListOutput,
  mapDashboardInstanceSkillsPluginsSkillsListQuery,
  mapDashboardInstanceSkillsPluginsSkillsRemoveOutput,
  mapDashboardInstanceSkillsPluginsSkillsUpdateBody,
  mapDashboardInstanceSkillsPluginsSkillsUpdateOutput,
  type DashboardInstanceSkillsPluginsSkillsAddBody,
  type DashboardInstanceSkillsPluginsSkillsAddOutput,
  type DashboardInstanceSkillsPluginsSkillsGetOutput,
  type DashboardInstanceSkillsPluginsSkillsListOutput,
  type DashboardInstanceSkillsPluginsSkillsListQuery,
  type DashboardInstanceSkillsPluginsSkillsRemoveOutput,
  type DashboardInstanceSkillsPluginsSkillsUpdateBody,
  type DashboardInstanceSkillsPluginsSkillsUpdateOutput
} from '../resources';

/**
 * @name Skill Plugin Skills controller
 * @description Manage skill links for skill plugins.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillsPluginsSkillsEndpoint {
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
   * @name List skill plugin skills
   * @description Returns skills linked to a skill plugin.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `query` - DashboardInstanceSkillsPluginsSkillsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsSkillsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    skillPluginId: string,
    query?: DashboardInstanceSkillsPluginsSkillsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsSkillsListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/skills`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsPluginsSkillsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsPluginsSkillsListOutput
    );
  }

  /**
   * @name Add skill plugin skill
   * @description Adds a skill to a skill plugin.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `body` - DashboardInstanceSkillsPluginsSkillsAddBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsSkillsAddOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  add(
    instanceId: string,
    skillPluginId: string,
    body: DashboardInstanceSkillsPluginsSkillsAddBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsSkillsAddOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/skills`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsPluginsSkillsAddBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsPluginsSkillsAddOutput
    );
  }

  /**
   * @name Get skill plugin skill
   * @description Retrieves a skill plugin skill link.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `skillPluginSkillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsSkillsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillPluginId: string,
    skillPluginSkillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsSkillsGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/skills/${skillPluginSkillId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsPluginsSkillsGetOutput
    );
  }

  /**
   * @name Update skill plugin skill
   * @description Updates a skill plugin skill link.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `skillPluginSkillId` - string
   * @param `body` - DashboardInstanceSkillsPluginsSkillsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsSkillsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    skillPluginId: string,
    skillPluginSkillId: string,
    body: DashboardInstanceSkillsPluginsSkillsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsSkillsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/skills/${skillPluginSkillId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsPluginsSkillsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsPluginsSkillsUpdateOutput
    );
  }

  /**
   * @name Remove skill plugin skill
   * @description Removes a skill from a skill plugin.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `skillPluginSkillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsSkillsRemoveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  remove(
    instanceId: string,
    skillPluginId: string,
    skillPluginSkillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsSkillsRemoveOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/skills/${skillPluginSkillId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsPluginsSkillsRemoveOutput
    );
  }
}
