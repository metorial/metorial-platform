import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsAuthAppGetOutput,
  type DashboardInstancePortalsAuthAppGetOutput
} from '../resources';

/**
 * @name Portal Auth controller
 * @description Manage the Ares-backed authentication configuration for a portal.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePortalsAuthAppEndpoint {
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
   * @name Get portal auth app
   * @description Returns the Ares app configuration for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAuthAppGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAuthAppGetOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/auth/app`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAuthAppGetOutput
    );
  }
}
