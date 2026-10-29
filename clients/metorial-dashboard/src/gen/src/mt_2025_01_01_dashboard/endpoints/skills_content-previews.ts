import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsContentPreviewsListOutput,
  mapDashboardInstanceSkillsContentPreviewsListQuery,
  type DashboardInstanceSkillsContentPreviewsListOutput,
  type DashboardInstanceSkillsContentPreviewsListQuery
} from '../resources';

/**
 * @name Skill Content Previews controller
 * @description Read the beginning of the SKILL.md of many skills at once.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsContentPreviewsEndpoint {
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
   * @name List skill content previews
   * @description Returns the beginning of the SKILL.md file of up to 50 skills in a single request.
   *
   * @param `query` - DashboardInstanceSkillsContentPreviewsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsContentPreviewsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSkillsContentPreviewsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsContentPreviewsListOutput> {
    let path = 'skill-content-previews';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsContentPreviewsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsContentPreviewsListOutput
    );
  }
}
