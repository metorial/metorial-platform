import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureToolCallingGetOutput,
  mapDashboardProjectsConfigureToolCallingUpdateBody,
  mapDashboardProjectsConfigureToolCallingUpdateOutput,
  type DashboardProjectsConfigureToolCallingGetOutput,
  type DashboardProjectsConfigureToolCallingUpdateBody,
  type DashboardProjectsConfigureToolCallingUpdateOutput
} from '../resources';

/**
 * @name Tool calling configuration controller
 * @description Configure project-level tool calling settings
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureToolCallingEndpoint {
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
   * @name Get project tool calling configuration
   * @description Get tool calling settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureToolCallingGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureToolCallingGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/tool-calling`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureToolCallingGetOutput
    );
  }

  /**
   * @name Update project tool calling configuration
   * @description Update tool calling settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureToolCallingUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureToolCallingUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureToolCallingUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureToolCallingUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/tool-calling`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureToolCallingUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureToolCallingUpdateOutput
    );
  }
}
