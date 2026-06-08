import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceStoresPermissionsGetOutput,
  type DashboardInstanceStoresPermissionsGetOutput
} from '../resources';

/**
 * @name Stores controller
 * @description Create and manage instance stores backed by Cargo.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceStoresPermissionsEndpoint {
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
   * @name Get store permissions
   * @description Returns the effective Cargo permissions for the current actor on a specific store.
   *
   * @param `instanceId` - string
   * @param `storeId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresPermissionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    storeId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresPermissionsGetOutput> {
    let path = `instances/${instanceId}/stores/${storeId}/permissions`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceStoresPermissionsGetOutput
    );
  }
}
