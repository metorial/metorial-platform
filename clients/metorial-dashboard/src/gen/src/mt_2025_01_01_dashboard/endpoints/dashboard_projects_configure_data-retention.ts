import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureDataRetentionGetOutput,
  mapDashboardProjectsConfigureDataRetentionUpdateBody,
  mapDashboardProjectsConfigureDataRetentionUpdateOutput,
  type DashboardProjectsConfigureDataRetentionGetOutput,
  type DashboardProjectsConfigureDataRetentionUpdateBody,
  type DashboardProjectsConfigureDataRetentionUpdateOutput
} from '../resources';

/**
 * @name Data retention configuration controller
 * @description Configure how much integration message data a project stores
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureDataRetentionEndpoint {
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
   * @name Get project data retention configuration
   * @description Get message data retention settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureDataRetentionGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureDataRetentionGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/data-retention`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureDataRetentionGetOutput
    );
  }

  /**
   * @name Update project data retention configuration
   * @description Update message data retention settings for a project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureDataRetentionUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureDataRetentionUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureDataRetentionUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureDataRetentionUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/data-retention`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureDataRetentionUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureDataRetentionUpdateOutput
    );
  }
}
