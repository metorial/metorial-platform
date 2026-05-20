import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureRetentionGetOutput,
  mapDashboardProjectsConfigureRetentionUpdateBody,
  mapDashboardProjectsConfigureRetentionUpdateOutput,
  type DashboardProjectsConfigureRetentionGetOutput,
  type DashboardProjectsConfigureRetentionUpdateBody,
  type DashboardProjectsConfigureRetentionUpdateOutput
} from '../resources';

/**
 * @name Project configuration controller
 * @description Configure project-level settings
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureRetentionEndpoint {
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
   * @name Get project retention configuration
   * @description Get log retention settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureRetentionGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureRetentionGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/retention`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureRetentionGetOutput
    );
  }

  /**
   * @name Update project retention configuration
   * @description Update log retention settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureRetentionUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureRetentionUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureRetentionUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureRetentionUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/retention`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureRetentionUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureRetentionUpdateOutput
    );
  }
}
