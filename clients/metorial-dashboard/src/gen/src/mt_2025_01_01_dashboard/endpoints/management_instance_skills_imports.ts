import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsImportsCreateBody,
  mapDashboardInstanceSkillsImportsCreateOutput,
  mapDashboardInstanceSkillsImportsGetOutput,
  mapDashboardInstanceSkillsImportsListOutput,
  mapDashboardInstanceSkillsImportsListQuery,
  type DashboardInstanceSkillsImportsCreateBody,
  type DashboardInstanceSkillsImportsCreateOutput,
  type DashboardInstanceSkillsImportsGetOutput,
  type DashboardInstanceSkillsImportsListOutput,
  type DashboardInstanceSkillsImportsListQuery
} from '../resources';

/**
 * @name Skill Imports controller
 * @description Import skills from public or configured source repositories.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillsImportsEndpoint {
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
   * @name List skill imports
   * @description Returns a paginated list of skill imports.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSkillsImportsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsImportsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSkillsImportsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsImportsListOutput> {
    let path = `instances/${instanceId}/skill-imports`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsImportsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsImportsListOutput
    );
  }

  /**
   * @name Get skill import
   * @description Retrieves an individual skill import and its results.
   *
   * @param `instanceId` - string
   * @param `skillImportId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsImportsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillImportId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsImportsGetOutput> {
    let path = `instances/${instanceId}/skill-imports/${skillImportId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsImportsGetOutput
    );
  }

  /**
   * @name Create skill import
   * @description Queues a skill import from a public or configured source repository.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSkillsImportsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsImportsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSkillsImportsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsImportsCreateOutput> {
    let path = `instances/${instanceId}/skill-imports`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsImportsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsImportsCreateOutput
    );
  }
}
