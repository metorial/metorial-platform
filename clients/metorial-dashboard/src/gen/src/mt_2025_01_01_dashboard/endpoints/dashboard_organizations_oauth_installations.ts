import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOauthInstallationsGetOutput,
  mapDashboardOrganizationsOauthInstallationsListOutput,
  mapDashboardOrganizationsOauthInstallationsListQuery,
  mapDashboardOrganizationsOauthInstallationsRevokeOutput,
  type DashboardOrganizationsOauthInstallationsGetOutput,
  type DashboardOrganizationsOauthInstallationsListOutput,
  type DashboardOrganizationsOauthInstallationsListQuery,
  type DashboardOrganizationsOauthInstallationsRevokeOutput
} from '../resources';

/**
 * @name OAuth Installation controller
 * @description Inspect and revoke OAuth app installations for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsOauthInstallationsEndpoint {
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
   * @name List organization OAuth installations
   * @description Returns a paginated list of OAuth installations for the organization.
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsOauthInstallationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthInstallationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsOauthInstallationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthInstallationsListOutput> {
    let path = `dashboard/organizations/${organizationId}/oauth/installations`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOauthInstallationsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthInstallationsListOutput
    );
  }

  /**
   * @name Get organization OAuth installation
   * @description Retrieves a specific OAuth installation for the organization.
   *
   * @param `organizationId` - string
   * @param `oauthInstallationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthInstallationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    oauthInstallationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthInstallationsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/oauth/installations/${oauthInstallationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthInstallationsGetOutput
    );
  }

  /**
   * @name Revoke organization OAuth installation
   * @description Revokes a specific OAuth installation for the organization.
   *
   * @param `organizationId` - string
   * @param `oauthInstallationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthInstallationsRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    organizationId: string,
    oauthInstallationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthInstallationsRevokeOutput> {
    let path = `dashboard/organizations/${organizationId}/oauth/installations/${oauthInstallationId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOauthInstallationsRevokeOutput
    );
  }
}
