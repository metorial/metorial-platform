import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureWorkforceGetOutput,
  mapDashboardProjectsConfigureWorkforceUpdateBody,
  mapDashboardProjectsConfigureWorkforceUpdateOutput,
  type DashboardProjectsConfigureWorkforceGetOutput,
  type DashboardProjectsConfigureWorkforceUpdateBody,
  type DashboardProjectsConfigureWorkforceUpdateOutput
} from '../resources';

/**
 * @name Workforce configuration controller
 * @description Configure project-level workforce settings
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureWorkforceEndpoint {
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
   * @name Get project workforce configuration
   * @description Get workforce settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureWorkforceGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureWorkforceGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/workforce`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureWorkforceGetOutput
    );
  }

  /**
   * @name Update project workforce configuration
   * @description Update workforce settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureWorkforceUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureWorkforceUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureWorkforceUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureWorkforceUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/workforce`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureWorkforceUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureWorkforceUpdateOutput
    );
  }
}
