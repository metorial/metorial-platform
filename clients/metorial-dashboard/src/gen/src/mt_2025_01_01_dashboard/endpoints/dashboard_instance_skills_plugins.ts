import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsPluginsArchiveOutput,
  mapDashboardInstanceSkillsPluginsCreateBody,
  mapDashboardInstanceSkillsPluginsCreateOutput,
  mapDashboardInstanceSkillsPluginsGetOutput,
  mapDashboardInstanceSkillsPluginsListOutput,
  mapDashboardInstanceSkillsPluginsListQuery,
  mapDashboardInstanceSkillsPluginsSyncBody,
  mapDashboardInstanceSkillsPluginsSyncOutput,
  mapDashboardInstanceSkillsPluginsUpdateBody,
  mapDashboardInstanceSkillsPluginsUpdateOutput,
  type DashboardInstanceSkillsPluginsArchiveOutput,
  type DashboardInstanceSkillsPluginsCreateBody,
  type DashboardInstanceSkillsPluginsCreateOutput,
  type DashboardInstanceSkillsPluginsGetOutput,
  type DashboardInstanceSkillsPluginsListOutput,
  type DashboardInstanceSkillsPluginsListQuery,
  type DashboardInstanceSkillsPluginsSyncBody,
  type DashboardInstanceSkillsPluginsSyncOutput,
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
export class MetorialDashboardInstanceSkillsPluginsEndpoint {
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
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSkillsPluginsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSkillsPluginsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins`;

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
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillPluginId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}`;

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
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSkillsPluginsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSkillsPluginsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins`;

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
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `body` - DashboardInstanceSkillsPluginsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    skillPluginId: string,
    body: DashboardInstanceSkillsPluginsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}`;

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
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsArchiveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  archive(
    instanceId: string,
    skillPluginId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsArchiveOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsPluginsArchiveOutput
    );
  }

  /**
   * @name Sync skill plugin
   * @description Forces a skill plugin sync.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `body` - DashboardInstanceSkillsPluginsSyncBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsSyncOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  sync(
    instanceId: string,
    skillPluginId: string,
    body: DashboardInstanceSkillsPluginsSyncBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsSyncOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/sync`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsPluginsSyncBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsPluginsSyncOutput
    );
  }
}
