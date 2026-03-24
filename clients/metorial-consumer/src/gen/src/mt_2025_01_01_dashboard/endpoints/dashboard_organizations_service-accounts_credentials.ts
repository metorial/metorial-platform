import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsServiceAccountsCredentialsGetOutput,
  mapDashboardOrganizationsServiceAccountsCredentialsListOutput,
  mapDashboardOrganizationsServiceAccountsCredentialsListQuery,
  type DashboardOrganizationsServiceAccountsCredentialsGetOutput,
  type DashboardOrganizationsServiceAccountsCredentialsListOutput,
  type DashboardOrganizationsServiceAccountsCredentialsListQuery
} from '../resources';

/**
 * @name Service Account controller
 * @description Create and manage service accounts for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsServiceAccountsCredentialsEndpoint {
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
   * @name List service account credentials
   * @description Returns a paginated list of credentials for a service account.
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `query` - DashboardOrganizationsServiceAccountsCredentialsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsCredentialsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    serviceAccountId: string,
    query?: DashboardOrganizationsServiceAccountsCredentialsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsCredentialsListOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}/credentials`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsServiceAccountsCredentialsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsServiceAccountsCredentialsListOutput
    );
  }

  /**
   * @name Get service account credential
   * @description Retrieves a specific credential for a service account.
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `serviceAccountCredentialId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsCredentialsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    serviceAccountId: string,
    serviceAccountCredentialId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsCredentialsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}/credentials/${serviceAccountCredentialId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsServiceAccountsCredentialsGetOutput
    );
  }
}
