import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceDocumentsPermissionsGetOutput,
  type DashboardInstanceDocumentsPermissionsGetOutput
} from '../resources';

/**
 * @name Documents controller
 * @description Create and manage instance documents backed by Cargo.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDocumentsPermissionsEndpoint {
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
   * @name Get document permissions
   * @description Returns the effective Cargo permissions for the current actor on a specific document.
   *
   * @param `documentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsPermissionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    documentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsPermissionsGetOutput> {
    let path = `documents/${documentId}/permissions`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsPermissionsGetOutput
    );
  }
}
