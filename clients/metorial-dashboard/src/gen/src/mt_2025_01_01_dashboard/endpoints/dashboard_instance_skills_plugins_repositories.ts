import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsPluginsRepositoriesCreateBody,
  mapDashboardInstanceSkillsPluginsRepositoriesCreateOutput,
  mapDashboardInstanceSkillsPluginsRepositoriesDeleteOutput,
  mapDashboardInstanceSkillsPluginsRepositoriesGetOutput,
  mapDashboardInstanceSkillsPluginsRepositoriesListOutput,
  mapDashboardInstanceSkillsPluginsRepositoriesListQuery,
  type DashboardInstanceSkillsPluginsRepositoriesCreateBody,
  type DashboardInstanceSkillsPluginsRepositoriesCreateOutput,
  type DashboardInstanceSkillsPluginsRepositoriesDeleteOutput,
  type DashboardInstanceSkillsPluginsRepositoriesGetOutput,
  type DashboardInstanceSkillsPluginsRepositoriesListOutput,
  type DashboardInstanceSkillsPluginsRepositoriesListQuery
} from '../resources';

/**
 * @name Skill Plugin Repositories controller
 * @description Manage repositories linked to skill plugins for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillsPluginsRepositoriesEndpoint {
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
   * @name List skill plugin repositories
   * @description Returns repositories linked to a skill plugin.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `query` - DashboardInstanceSkillsPluginsRepositoriesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsRepositoriesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    skillPluginId: string,
    query?: DashboardInstanceSkillsPluginsRepositoriesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsRepositoriesListOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/repositories`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsPluginsRepositoriesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsPluginsRepositoriesListOutput
    );
  }

  /**
   * @name Get skill plugin repository
   * @description Retrieves a repository linked to a skill plugin.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `skillPluginRepositoryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsRepositoriesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillPluginId: string,
    skillPluginRepositoryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsRepositoriesGetOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/repositories/${skillPluginRepositoryId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsPluginsRepositoriesGetOutput
    );
  }

  /**
   * @name Link skill plugin repository
   * @description Links an SCM repository to a skill plugin.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `body` - DashboardInstanceSkillsPluginsRepositoriesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsRepositoriesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    skillPluginId: string,
    body: DashboardInstanceSkillsPluginsRepositoriesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsRepositoriesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/repositories`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsPluginsRepositoriesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsPluginsRepositoriesCreateOutput
    );
  }

  /**
   * @name Unlink skill plugin repository
   * @description Unlinks an SCM repository from a skill plugin.
   *
   * @param `instanceId` - string
   * @param `skillPluginId` - string
   * @param `skillPluginRepositoryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsRepositoriesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillPluginId: string,
    skillPluginRepositoryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsRepositoriesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/skill-plugins/${skillPluginId}/repositories/${skillPluginRepositoryId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsPluginsRepositoriesDeleteOutput
    );
  }
}
