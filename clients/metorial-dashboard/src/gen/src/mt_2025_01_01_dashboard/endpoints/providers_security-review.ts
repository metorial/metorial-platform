import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersSecurityReviewGetOutput,
  mapDashboardInstanceProvidersSecurityReviewGetQuery,
  type DashboardInstanceProvidersSecurityReviewGetOutput,
  type DashboardInstanceProvidersSecurityReviewGetQuery
} from '../resources';

/**
 * @name Provider Security Reviews controller
 * @description An AI security review assesses how trustworthy a provider version is and what its tools can do. Reviews of Metorial integrations are shared across organizations; reviews of custom providers are private to the organization.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProvidersSecurityReviewEndpoint {
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
   * @name Get provider security review
   * @description Returns the security review of a provider's current version, or of the version given in the query. Requests a review if none exists yet.
   *
   * @param `providerId` - string
   * @param `query` - DashboardInstanceProvidersSecurityReviewGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersSecurityReviewGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerId: string,
    query?: DashboardInstanceProvidersSecurityReviewGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersSecurityReviewGetOutput> {
    let path = `providers/${providerId}/security-review`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersSecurityReviewGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersSecurityReviewGetOutput
    );
  }
}
