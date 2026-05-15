import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsPluginsArchiveOutput,
  mapDashboardInstanceSkillsPluginsCreateBody,
  mapDashboardInstanceSkillsPluginsCreateOutput,
  mapDashboardInstanceSkillsPluginsGetEditorUrlBody,
  mapDashboardInstanceSkillsPluginsGetEditorUrlOutput,
  mapDashboardInstanceSkillsPluginsGetOutput,
  mapDashboardInstanceSkillsPluginsListOutput,
  mapDashboardInstanceSkillsPluginsListQuery,
  mapDashboardInstanceSkillsPluginsUpdateBody,
  mapDashboardInstanceSkillsPluginsUpdateOutput,
  type DashboardInstanceSkillsPluginsArchiveOutput,
  type DashboardInstanceSkillsPluginsCreateBody,
  type DashboardInstanceSkillsPluginsCreateOutput,
  type DashboardInstanceSkillsPluginsGetEditorUrlBody,
  type DashboardInstanceSkillsPluginsGetEditorUrlOutput,
  type DashboardInstanceSkillsPluginsGetOutput,
  type DashboardInstanceSkillsPluginsListOutput,
  type DashboardInstanceSkillsPluginsListQuery,
  type DashboardInstanceSkillsPluginsUpdateBody,
  type DashboardInstanceSkillsPluginsUpdateOutput
} from '../resources';

/**
 * @name Skill Plugins controller
 * @description Manage skill plugins for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsPluginsEndpoint {
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
   * @name List skill plugins
   * @description Returns a paginated list of skill plugins.
   *
   * @param `query` - DashboardInstanceSkillsPluginsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSkillsPluginsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsListOutput> {
    let path = 'skill-plugins';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsPluginsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsPluginsListOutput
    );
  }

  /**
   * @name Get skill plugin
   * @description Retrieves a skill plugin.
   *
   * @param `skillPluginId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillPluginId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsGetOutput> {
    let path = `skill-plugins/${skillPluginId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsPluginsGetOutput
    );
  }

  /**
   * @name Create skill plugin
   * @description Creates a skill plugin.
   *
   * @param `body` - DashboardInstanceSkillsPluginsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSkillsPluginsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsCreateOutput> {
    let path = 'skill-plugins';

    let request = {
      path,
      body: mapDashboardInstanceSkillsPluginsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsPluginsCreateOutput
    );
  }

  /**
   * @name Update skill plugin
   * @description Updates a skill plugin.
   *
   * @param `skillPluginId` - string
   * @param `body` - DashboardInstanceSkillsPluginsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    skillPluginId: string,
    body: DashboardInstanceSkillsPluginsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsUpdateOutput> {
    let path = `skill-plugins/${skillPluginId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsPluginsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsPluginsUpdateOutput
    );
  }

  /**
   * @name Archive skill plugin
   * @description Archives a skill plugin.
   *
   * @param `skillPluginId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsArchiveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  archive(
    skillPluginId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsArchiveOutput> {
    let path = `skill-plugins/${skillPluginId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsPluginsArchiveOutput
    );
  }

  /**
   * @name Get skill plugin editor URL
   * @description Creates an embeddable editor URL for a skill plugin.
   *
   * @param `skillPluginId` - string
   * @param `body` - DashboardInstanceSkillsPluginsGetEditorUrlBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsGetEditorUrlOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getEditorUrl(
    skillPluginId: string,
    body: DashboardInstanceSkillsPluginsGetEditorUrlBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsGetEditorUrlOutput> {
    let path = `skill-plugins/${skillPluginId}/editor-url`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsPluginsGetEditorUrlBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsPluginsGetEditorUrlOutput
    );
  }
}
