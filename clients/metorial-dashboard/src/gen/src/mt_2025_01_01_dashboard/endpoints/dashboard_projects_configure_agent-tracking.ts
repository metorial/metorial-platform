import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsConfigureAgentTrackingGetOutput,
  mapDashboardProjectsConfigureAgentTrackingUpdateBody,
  mapDashboardProjectsConfigureAgentTrackingUpdateOutput,
  type DashboardProjectsConfigureAgentTrackingGetOutput,
  type DashboardProjectsConfigureAgentTrackingUpdateBody,
  type DashboardProjectsConfigureAgentTrackingUpdateOutput
} from '../resources';

/**
 * @name Agent Tracking Project Settings controller
 * @description The retention of agent tracking, for every instance of a project.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsConfigureAgentTrackingEndpoint {
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
   * @name Get agent tracking project settings
   * @description Returns the retention of agent tracking for the project.
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureAgentTrackingGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureAgentTrackingGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/agent-tracking`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsConfigureAgentTrackingGetOutput
    );
  }

  /**
   * @name Update agent tracking project settings
   * @description Changes the retention of the project; leaving a field out keeps its value. service_status says whether agent tracking has taken the change yet.
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardProjectsConfigureAgentTrackingUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsConfigureAgentTrackingUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardProjectsConfigureAgentTrackingUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsConfigureAgentTrackingUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/configure/agent-tracking`;

    let request = {
      path,
      body: mapDashboardProjectsConfigureAgentTrackingUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardProjectsConfigureAgentTrackingUpdateOutput
    );
  }
}
