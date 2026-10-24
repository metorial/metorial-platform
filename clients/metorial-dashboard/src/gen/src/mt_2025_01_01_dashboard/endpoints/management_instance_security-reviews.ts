import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSecurityReviewsGetOutput,
  mapDashboardInstanceSecurityReviewsReassessOutput,
  type DashboardInstanceSecurityReviewsGetOutput,
  type DashboardInstanceSecurityReviewsReassessOutput
} from '../resources';

/**
 * @name Provider Security Reviews controller
 * @description An AI security review assesses how trustworthy a provider version is and what its tools can do. Reviews of Metorial integrations are shared across organizations; reviews of custom providers are private to the organization.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSecurityReviewsEndpoint {
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
   * @name Get security review
   * @description Retrieves a security review with its current and in-progress revisions.
   *
   * @param `instanceId` - string
   * @param `securityReviewId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSecurityReviewsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    securityReviewId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSecurityReviewsGetOutput> {
    let path = `instances/${instanceId}/security-reviews/${securityReviewId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSecurityReviewsGetOutput
    );
  }

  /**
   * @name Reassess security review
   * @description Starts a new review of a custom provider. Available once every 24 hours; reviews of Metorial integrations are maintained by Metorial.
   *
   * @param `instanceId` - string
   * @param `securityReviewId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSecurityReviewsReassessOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reassess(
    instanceId: string,
    securityReviewId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSecurityReviewsReassessOutput> {
    let path = `instances/${instanceId}/security-reviews/${securityReviewId}/reassess`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSecurityReviewsReassessOutput
    );
  }
}
