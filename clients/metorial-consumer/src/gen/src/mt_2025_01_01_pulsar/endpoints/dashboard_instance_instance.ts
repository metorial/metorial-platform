import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceInstanceGetOutput,
  type DashboardInstanceInstanceGetOutput
} from '../resources';

/**
 * @name Instance controller
 * @description Instances are independent environments within Metorial, each with its own configuration and data. Each instance is a port of a Metorial project. You can for example create production, staging, and development instances for your project.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceInstanceEndpoint {
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
   * @name Get instance details
   * @description Retrieves metadata and configuration details for a specific instance.
   *
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceInstanceGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceInstanceGetOutput> {
    let path = `dashboard/instances/${instanceId}/instance`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceInstanceGetOutput);
  }
}
