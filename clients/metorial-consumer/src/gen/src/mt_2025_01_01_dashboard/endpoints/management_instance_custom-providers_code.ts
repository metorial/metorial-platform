import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput,
  type DashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput
} from '../resources';

/**
 * @name Custom Provider Code controller
 * @description Manage custom provider code editor access.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceCustomProvidersCodeEndpoint {
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
   * @name Get code editor token
   * @description Get a token to access the code editor for a custom provider.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getCodeEditorToken(
    instanceId: string,
    customProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput> {
    let path = `instances/${instanceId}/custom-providers/${customProviderId}/code-editor-token`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput
    );
  }
}
