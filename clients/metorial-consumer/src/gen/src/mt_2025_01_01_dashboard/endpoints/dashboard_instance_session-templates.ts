import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionTemplatesCreateBody,
  mapDashboardInstanceSessionTemplatesCreateOutput,
  mapDashboardInstanceSessionTemplatesGetOutput,
  mapDashboardInstanceSessionTemplatesListOutput,
  mapDashboardInstanceSessionTemplatesListQuery,
  mapDashboardInstanceSessionTemplatesUpdateBody,
  mapDashboardInstanceSessionTemplatesUpdateOutput,
  type DashboardInstanceSessionTemplatesCreateBody,
  type DashboardInstanceSessionTemplatesCreateOutput,
  type DashboardInstanceSessionTemplatesGetOutput,
  type DashboardInstanceSessionTemplatesListOutput,
  type DashboardInstanceSessionTemplatesListQuery,
  type DashboardInstanceSessionTemplatesUpdateBody,
  type DashboardInstanceSessionTemplatesUpdateOutput
} from '../resources';

/**
 * @name Session Templates controller
 * @description Session templates define reusable configurations for sessions, including which providers to include. Templates can be used to quickly create new sessions with consistent settings.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSessionTemplatesEndpoint {
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
   * @name List session templates
   * @description Returns a paginated list of session templates.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSessionTemplatesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSessionTemplatesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesListOutput> {
    let path = `dashboard/instances/${instanceId}/session-templates`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionTemplatesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionTemplatesListOutput);
  }

  /**
   * @name Get session template
   * @description Retrieves a specific session template by ID.
   *
   * @param `instanceId` - string
   * @param `sessionTemplateId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionTemplateId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesGetOutput> {
    let path = `dashboard/instances/${instanceId}/session-templates/${sessionTemplateId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionTemplatesGetOutput);
  }

  /**
   * @name Create session template
   * @description Creates a new session template.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSessionTemplatesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSessionTemplatesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/session-templates`;

    let request = {
      path,
      body: mapDashboardInstanceSessionTemplatesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceSessionTemplatesCreateOutput);
  }

  /**
   * @name Update session template
   * @description Updates a specific session template.
   *
   * @param `instanceId` - string
   * @param `sessionTemplateId` - string
   * @param `body` - DashboardInstanceSessionTemplatesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionTemplatesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    sessionTemplateId: string,
    body: DashboardInstanceSessionTemplatesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionTemplatesUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/session-templates/${sessionTemplateId}`;

    let request = {
      path,
      body: mapDashboardInstanceSessionTemplatesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceSessionTemplatesUpdateOutput);
  }
}
