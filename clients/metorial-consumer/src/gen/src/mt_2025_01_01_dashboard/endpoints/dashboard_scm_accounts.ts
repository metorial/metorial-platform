import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardScmAccountsPreviewOutput,
  mapDashboardScmAccountsPreviewQuery,
  type DashboardScmAccountsPreviewOutput,
  type DashboardScmAccountsPreviewQuery
} from '../resources';

/**
 * @name SCM Repo controller
 * @description Read and write SCM repository information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardScmAccountsEndpoint {
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
   * @name List SCM Repositories
   * @description List SCM accounts for all organizations the user is a member of
   *
   * @param `organizationId` - string
   * @param `query` - DashboardScmAccountsPreviewQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardScmAccountsPreviewOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  preview(
    organizationId: string,
    query?: DashboardScmAccountsPreviewQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardScmAccountsPreviewOutput> {
    let path = `dashboard/organizations/${organizationId}/scm/accounts/preview`;

    let request = {
      path,

      query: query
        ? mapDashboardScmAccountsPreviewQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardScmAccountsPreviewOutput);
  }
}
