import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOauthAuthorizationLogsListOutput,
  mapDashboardOrganizationsOauthAuthorizationLogsListQuery,
  type DashboardOrganizationsOauthAuthorizationLogsListOutput,
  type DashboardOrganizationsOauthAuthorizationLogsListQuery
} from '../resources';

/**
 * @name OAuth Authorization Log controller
 * @description Inspect OAuth authorization requests for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationOauthAuthorizationLogsEndpoint {
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
   * @name List organization OAuth authorization logs
   * @description Returns a paginated list of OAuth authorization requests for the organization.
   *
   * @param `query` - DashboardOrganizationsOauthAuthorizationLogsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAuthorizationLogsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsOauthAuthorizationLogsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAuthorizationLogsListOutput> {
    let path = 'organization/oauth/authorization-logs';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOauthAuthorizationLogsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthAuthorizationLogsListOutput
    );
  }
}
