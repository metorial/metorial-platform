import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderIssuesGetOutput,
  mapDashboardInstanceProviderIssuesListOutput,
  mapDashboardInstanceProviderIssuesListQuery,
  type DashboardInstanceProviderIssuesGetOutput,
  type DashboardInstanceProviderIssuesListOutput,
  type DashboardInstanceProviderIssuesListQuery
} from '../resources';

/**
 * @name Provider Issues controller
 * @description Provider issues aggregate repeated provider errors, authentication failures and ProtoGuard warnings into one record per distinct problem.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderIssuesEndpoint {
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
   * @name List provider issues
   * @description Returns a paginated list of provider issues. Only issue types the caller has read access to are included.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderIssuesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderIssuesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderIssuesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderIssuesListOutput> {
    let path = `instances/${instanceId}/provider-issues`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderIssuesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderIssuesListOutput
    );
  }

  /**
   * @name Get provider issue
   * @description Retrieves a specific provider issue.
   *
   * @param `instanceId` - string
   * @param `providerIssueId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderIssuesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerIssueId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderIssuesGetOutput> {
    let path = `instances/${instanceId}/provider-issues/${providerIssueId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderIssuesGetOutput
    );
  }
}
