import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardBootBody,
  mapDashboardBootOutput,
  type DashboardBootBody,
  type DashboardBootOutput
} from '../resources';

/**
 * @name Boot controller
 * @description Boot user
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardEndpoint {
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
   * @name Create organization
   * @description Create a new organization
   *
   * @param `body` - DashboardBootBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardBootOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  boot(
    body: DashboardBootBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardBootOutput> {
    let path = 'dashboard/boot';

    let request = {
      path,
      body: mapDashboardBootBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardBootOutput);
  }
}
