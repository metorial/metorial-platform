import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersCodeGetCodeEditorTokenOutput,
  type DashboardInstanceCustomServersCodeGetCodeEditorTokenOutput
} from '../resources';

/**
 * @name Custom Server code controller
 * @description Manager custom server deployments
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomServersCodeEndpoint {
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
   * @description Get a token to access the code editor for a custom server
   *
   * @param `customServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersCodeGetCodeEditorTokenOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getCodeEditorToken(
    customServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersCodeGetCodeEditorTokenOutput> {
    let path = `custom-servers/${customServerId}/code-editor-token`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersCodeGetCodeEditorTokenOutput
    );
  }
}
