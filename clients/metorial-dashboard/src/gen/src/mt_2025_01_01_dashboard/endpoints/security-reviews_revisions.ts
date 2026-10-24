import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSecurityReviewsRevisionsGetOutput,
  mapDashboardInstanceSecurityReviewsRevisionsListOutput,
  mapDashboardInstanceSecurityReviewsRevisionsListQuery,
  type DashboardInstanceSecurityReviewsRevisionsGetOutput,
  type DashboardInstanceSecurityReviewsRevisionsListOutput,
  type DashboardInstanceSecurityReviewsRevisionsListQuery
} from '../resources';

/**
 * @name Provider Security Reviews controller
 * @description An AI security review assesses how trustworthy a provider version is and what its tools can do. Reviews of Metorial integrations are shared across organizations; reviews of custom providers are private to the organization.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSecurityReviewsRevisionsEndpoint {
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
   * @name List security review revisions
   * @description Returns the most recent finished revisions of a security review.
   *
   * @param `securityReviewId` - string
   * @param `query` - DashboardInstanceSecurityReviewsRevisionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSecurityReviewsRevisionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    securityReviewId: string,
    query?: DashboardInstanceSecurityReviewsRevisionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSecurityReviewsRevisionsListOutput> {
    let path = `security-reviews/${securityReviewId}/revisions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSecurityReviewsRevisionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSecurityReviewsRevisionsListOutput
    );
  }

  /**
   * @name Get security review revision
   * @description Retrieves a single revision of a security review.
   *
   * @param `securityReviewId` - string
   * @param `revisionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSecurityReviewsRevisionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    securityReviewId: string,
    revisionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSecurityReviewsRevisionsGetOutput> {
    let path = `security-reviews/${securityReviewId}/revisions/${revisionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSecurityReviewsRevisionsGetOutput
    );
  }
}
