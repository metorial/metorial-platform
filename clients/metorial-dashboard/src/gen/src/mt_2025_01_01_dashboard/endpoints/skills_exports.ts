import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsExportsCreateBody,
  mapDashboardInstanceSkillsExportsCreateOutput,
  mapDashboardInstanceSkillsExportsGetOutput,
  mapDashboardInstanceSkillsExportsListOutput,
  mapDashboardInstanceSkillsExportsListQuery,
  type DashboardInstanceSkillsExportsCreateBody,
  type DashboardInstanceSkillsExportsCreateOutput,
  type DashboardInstanceSkillsExportsGetOutput,
  type DashboardInstanceSkillsExportsListOutput,
  type DashboardInstanceSkillsExportsListQuery
} from '../resources';

/**
 * @name Skill Exports controller
 * @description Export skills, skill plugins, and skill marketplaces as zip files.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsExportsEndpoint {
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
   * @name List skill exports
   * @description Returns a paginated list of skill exports.
   *
   * @param `query` - DashboardInstanceSkillsExportsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsExportsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSkillsExportsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsExportsListOutput> {
    let path = 'skill-exports';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsExportsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsExportsListOutput
    );
  }

  /**
   * @name Get skill export
   * @description Retrieves a skill export.
   *
   * @param `skillExportId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsExportsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillExportId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsExportsGetOutput> {
    let path = `skill-exports/${skillExportId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsExportsGetOutput
    );
  }

  /**
   * @name Create skill export
   * @description Creates a skill, plugin, or marketplace export.
   *
   * @param `body` - DashboardInstanceSkillsExportsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsExportsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSkillsExportsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsExportsCreateOutput> {
    let path = 'skill-exports';

    let request = {
      path,
      body: mapDashboardInstanceSkillsExportsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsExportsCreateOutput
    );
  }
}
