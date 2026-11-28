import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsPluginsSkillGroupMatchesListOutput,
  mapDashboardInstanceSkillsPluginsSkillGroupMatchesListQuery,
  type DashboardInstanceSkillsPluginsSkillGroupMatchesListOutput,
  type DashboardInstanceSkillsPluginsSkillGroupMatchesListQuery
} from '../resources';

/**
 * @name Skill Plugins controller
 * @description A skill plugin is a set of skills distributed through a skill marketplace.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsPluginsSkillGroupMatchesEndpoint {
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
   * @name List skill group matches
   * @description Compares a skill plugin with skill groups and returns the skills attaching each group would add or remove. Without a filter, returns up to 5 groups that share the most skills with the plugin.
   *
   * @param `skillPluginId` - string
   * @param `query` - DashboardInstanceSkillsPluginsSkillGroupMatchesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPluginsSkillGroupMatchesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillPluginId: string,
    query?: DashboardInstanceSkillsPluginsSkillGroupMatchesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPluginsSkillGroupMatchesListOutput> {
    let path = `skill-plugins/${encodeURIComponent(skillPluginId)}/skill-group-matches`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsPluginsSkillGroupMatchesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsPluginsSkillGroupMatchesListOutput
    );
  }
}
