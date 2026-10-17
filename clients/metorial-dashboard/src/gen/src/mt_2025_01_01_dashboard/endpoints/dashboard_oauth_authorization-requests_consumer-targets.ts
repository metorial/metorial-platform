import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOauthAuthorizationRequestsConsumerTargetsListOutput,
  type DashboardOauthAuthorizationRequestsConsumerTargetsListOutput
} from '../resources';

/**
 * @name OAuth Authorization Request controller
 * @description Read and approve oauth authorization requests
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOauthAuthorizationRequestsConsumerTargetsEndpoint {
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
   * @name List OAuth authorization request consumer targets
   * @description Lists the portal consumer profiles the current user can approve a consumer oauth authorization request as
   *
   * @param `urlToken` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOauthAuthorizationRequestsConsumerTargetsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    urlToken: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOauthAuthorizationRequestsConsumerTargetsListOutput> {
    let path = `dashboard/oauth/authorization-requests/${urlToken}/consumer-targets`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOauthAuthorizationRequestsConsumerTargetsListOutput
    );
  }
}
