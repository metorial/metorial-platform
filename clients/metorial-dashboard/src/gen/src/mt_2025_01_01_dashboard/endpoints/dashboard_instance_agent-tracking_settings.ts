import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingSettingsGetOutput,
  mapDashboardInstanceAgentTrackingSettingsUpdateBody,
  mapDashboardInstanceAgentTrackingSettingsUpdateOutput,
  type DashboardInstanceAgentTrackingSettingsGetOutput,
  type DashboardInstanceAgentTrackingSettingsUpdateBody,
  type DashboardInstanceAgentTrackingSettingsUpdateOutput
} from '../resources';

/**
 * @name Agent Tracking Settings controller
 * @description The content and classification settings of agent tracking, for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingSettingsEndpoint {
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
   * @name Get agent tracking settings
   * @description Returns the content and classification settings of agent tracking for the instance.
   *
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSettingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSettingsGetOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/settings`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingSettingsGetOutput
    );
  }

  /**
   * @name Update agent tracking settings
   * @description Changes the content and classification settings of the instance; leaving a field out keeps its value. service_status says whether agent tracking has taken the change yet.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAgentTrackingSettingsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSettingsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    body: DashboardInstanceAgentTrackingSettingsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSettingsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/settings`;

    let request = {
      path,
      body: mapDashboardInstanceAgentTrackingSettingsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceAgentTrackingSettingsUpdateOutput
    );
  }
}
