import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureAuthConfigGetOutput,
  mapDashboardProjectsConfigureAuthConfigUpdateBody,
  mapDashboardProjectsConfigureAuthConfigUpdateOutput,
  type DashboardProjectsConfigureAuthConfigGetOutput,
  type DashboardProjectsConfigureAuthConfigUpdateBody,
  type DashboardProjectsConfigureAuthConfigUpdateOutput
} from '../resources';

/**
 * @name Project configuration controller
 * @description Configure project-level settings
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureAuthConfigEndpoint {
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
   * @name Get project auth config configuration
   * @description Get auth config export/import settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureAuthConfigGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureAuthConfigGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/auth-config`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureAuthConfigGetOutput
    );
  }

  /**
   * @name Update project auth config configuration
   * @description Update auth config export/import settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureAuthConfigUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureAuthConfigUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureAuthConfigUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureAuthConfigUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/auth-config`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureAuthConfigUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureAuthConfigUpdateOutput
    );
  }
}
