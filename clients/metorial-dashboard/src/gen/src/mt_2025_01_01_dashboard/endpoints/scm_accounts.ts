import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceScmAccountsPreviewBody,
  mapDashboardInstanceScmAccountsPreviewOutput,
  type DashboardInstanceScmAccountsPreviewBody,
  type DashboardInstanceScmAccountsPreviewOutput
} from '../resources';

/**
 * @name SCM Accounts controller
 * @description Preview SCM accounts from an installation.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialScmAccountsEndpoint {
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
   * @name Preview SCM accounts
   * @description Lists available accounts from an SCM installation.
   *
   * @param `body` - DashboardInstanceScmAccountsPreviewBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmAccountsPreviewOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  preview(
    body: DashboardInstanceScmAccountsPreviewBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmAccountsPreviewOutput> {
    let path = 'scm/accounts/preview';

    let request = {
      path,
      body: mapDashboardInstanceScmAccountsPreviewBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceScmAccountsPreviewOutput
    );
  }
}
