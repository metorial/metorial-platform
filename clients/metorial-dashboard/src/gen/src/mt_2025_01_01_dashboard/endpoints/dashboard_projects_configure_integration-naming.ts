import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureIntegrationNamingGetOutput,
  mapDashboardProjectsConfigureIntegrationNamingUpdateBody,
  mapDashboardProjectsConfigureIntegrationNamingUpdateOutput,
  type DashboardProjectsConfigureIntegrationNamingGetOutput,
  type DashboardProjectsConfigureIntegrationNamingUpdateBody,
  type DashboardProjectsConfigureIntegrationNamingUpdateOutput
} from '../resources';

/**
 * @name Integration naming configuration controller
 * @description Configure project-level integration naming settings
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureIntegrationNamingEndpoint {
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
   * @name Get project integration naming configuration
   * @description Get integration naming settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureIntegrationNamingGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureIntegrationNamingGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/integration-naming`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureIntegrationNamingGetOutput
    );
  }

  /**
   * @name Update project integration naming configuration
   * @description Update integration naming settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureIntegrationNamingUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureIntegrationNamingUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureIntegrationNamingUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureIntegrationNamingUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/integration-naming`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureIntegrationNamingUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureIntegrationNamingUpdateOutput
    );
  }
}
