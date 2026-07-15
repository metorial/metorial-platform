import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceDocumentsEditTokenGetOutput,
  type DashboardInstanceDocumentsEditTokenGetOutput
} from '../resources';

/**
 * @name Documents controller
 * @description Create and manage instance documents backed by Cargo.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceDocumentsEditTokenEndpoint {
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
   * @name Get document edit token
   * @description Returns a short-lived token for establishing a collaborative document editing session.
   *
   * @param `instanceId` - string
   * @param `documentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceDocumentsEditTokenGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    documentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceDocumentsEditTokenGetOutput> {
    let path = `dashboard/instances/${instanceId}/documents/${documentId}/edit-token`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceDocumentsEditTokenGetOutput
    );
  }
}
