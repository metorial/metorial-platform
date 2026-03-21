import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOauthAuthorizationRequestsApproveBody,
  mapDashboardOauthAuthorizationRequestsApproveOutput,
  mapDashboardOauthAuthorizationRequestsGetOutput,
  mapDashboardOauthAuthorizationRequestsRejectOutput,
  type DashboardOauthAuthorizationRequestsApproveBody,
  type DashboardOauthAuthorizationRequestsApproveOutput,
  type DashboardOauthAuthorizationRequestsGetOutput,
  type DashboardOauthAuthorizationRequestsRejectOutput
} from '../resources';

/**
 * @name OAuth Authorization Request controller
 * @description Read and approve oauth authorization requests
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOauthAuthorizationRequestsEndpoint {
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
   * @name Get OAuth authorization request
   * @description Get an oauth authorization request by its url token
   *
   * @param `urlToken` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOauthAuthorizationRequestsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    urlToken: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOauthAuthorizationRequestsGetOutput> {
    let path = `dashboard/oauth/authorization-requests/${urlToken}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOauthAuthorizationRequestsGetOutput
    );
  }

  /**
   * @name Approve OAuth authorization request
   * @description Approve an oauth authorization request for an organization
   *
   * @param `urlToken` - string
   * @param `body` - DashboardOauthAuthorizationRequestsApproveBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOauthAuthorizationRequestsApproveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  approve(
    urlToken: string,
    body: DashboardOauthAuthorizationRequestsApproveBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOauthAuthorizationRequestsApproveOutput> {
    let path = `dashboard/oauth/authorization-requests/${urlToken}/approve`;

    let request = {
      path,
      body: mapDashboardOauthAuthorizationRequestsApproveBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOauthAuthorizationRequestsApproveOutput
    );
  }

  /**
   * @name Reject OAuth authorization request
   * @description Reject an oauth authorization request
   *
   * @param `urlToken` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOauthAuthorizationRequestsRejectOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reject(
    urlToken: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOauthAuthorizationRequestsRejectOutput> {
    let path = `dashboard/oauth/authorization-requests/${urlToken}/reject`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOauthAuthorizationRequestsRejectOutput
    );
  }
}
