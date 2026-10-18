import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureSessionlessMcpGetOutput,
  mapDashboardProjectsConfigureSessionlessMcpUpdateBody,
  mapDashboardProjectsConfigureSessionlessMcpUpdateOutput,
  type DashboardProjectsConfigureSessionlessMcpGetOutput,
  type DashboardProjectsConfigureSessionlessMcpUpdateBody,
  type DashboardProjectsConfigureSessionlessMcpUpdateOutput
} from '../resources';

/**
 * @name Sessionless MCP configuration controller
 * @description Configure whether a project accepts sessionless MCP connections
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureSessionlessMcpEndpoint {
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
   * @name Get project sessionless MCP configuration
   * @description Get the sessionless MCP setting for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureSessionlessMcpGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureSessionlessMcpGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/sessionless-mcp`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureSessionlessMcpGetOutput
    );
  }

  /**
   * @name Update project sessionless MCP configuration
   * @description Enable or disable sessionless MCP connections for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureSessionlessMcpUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureSessionlessMcpUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureSessionlessMcpUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureSessionlessMcpUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/sessionless-mcp`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureSessionlessMcpUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureSessionlessMcpUpdateOutput
    );
  }
}
