import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOauthAuthorizationsGetOutput,
  mapDashboardOrganizationsOauthAuthorizationsListOutput,
  mapDashboardOrganizationsOauthAuthorizationsListQuery,
  mapDashboardOrganizationsOauthAuthorizationsRevokeOutput,
  type DashboardOrganizationsOauthAuthorizationsGetOutput,
  type DashboardOrganizationsOauthAuthorizationsListOutput,
  type DashboardOrganizationsOauthAuthorizationsListQuery,
  type DashboardOrganizationsOauthAuthorizationsRevokeOutput
} from '../resources';

/**
 * @name OAuth Authorization controller
 * @description Inspect and revoke OAuth authorizations for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsOauthAuthorizationsEndpoint {
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
   * @name List organization OAuth authorizations
   * @description Returns a paginated list of OAuth authorizations for the organization.
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsOauthAuthorizationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAuthorizationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsOauthAuthorizationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAuthorizationsListOutput> {
    let path = `dashboard/organizations/${organizationId}/oauth/authorizations`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOauthAuthorizationsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthAuthorizationsListOutput
    );
  }

  /**
   * @name Get organization OAuth authorization
   * @description Retrieves a specific OAuth authorization for the organization.
   *
   * @param `organizationId` - string
   * @param `oauthAuthorizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAuthorizationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    oauthAuthorizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAuthorizationsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/oauth/authorizations/${oauthAuthorizationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthAuthorizationsGetOutput
    );
  }

  /**
   * @name Revoke organization OAuth authorization
   * @description Revokes a specific OAuth authorization for the organization.
   *
   * @param `organizationId` - string
   * @param `oauthAuthorizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAuthorizationsRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    organizationId: string,
    oauthAuthorizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAuthorizationsRevokeOutput> {
    let path = `dashboard/organizations/${organizationId}/oauth/authorizations/${oauthAuthorizationId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOauthAuthorizationsRevokeOutput
    );
  }
}
