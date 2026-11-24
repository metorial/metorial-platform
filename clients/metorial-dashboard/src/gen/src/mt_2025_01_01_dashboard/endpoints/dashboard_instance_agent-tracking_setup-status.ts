import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingSetupStatusGetOutput,
  type DashboardInstanceAgentTrackingSetupStatusGetOutput
} from '../resources';

/**
 * @name Agent Tracking Setup Status controller
 * @description Whether data is arriving, and which settings file options it shows are on.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingSetupStatusEndpoint {
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
   * @name Get setup status
   * @description Returns when data last arrived for the instance and, for each option of the settings file, whether the data of the last 30 days shows it is on. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSetupStatusGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSetupStatusGetOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/setup-status`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentTrackingSetupStatusGetOutput);
  }
}
