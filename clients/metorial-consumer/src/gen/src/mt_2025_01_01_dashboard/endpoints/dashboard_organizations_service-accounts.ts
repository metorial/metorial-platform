import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsServiceAccountsCreateBody,
  mapDashboardOrganizationsServiceAccountsCreateOutput,
  mapDashboardOrganizationsServiceAccountsDeleteOutput,
  mapDashboardOrganizationsServiceAccountsGetOutput,
  mapDashboardOrganizationsServiceAccountsListOutput,
  mapDashboardOrganizationsServiceAccountsListQuery,
  mapDashboardOrganizationsServiceAccountsUpdateBody,
  mapDashboardOrganizationsServiceAccountsUpdateOutput,
  type DashboardOrganizationsServiceAccountsCreateBody,
  type DashboardOrganizationsServiceAccountsCreateOutput,
  type DashboardOrganizationsServiceAccountsDeleteOutput,
  type DashboardOrganizationsServiceAccountsGetOutput,
  type DashboardOrganizationsServiceAccountsListOutput,
  type DashboardOrganizationsServiceAccountsListQuery,
  type DashboardOrganizationsServiceAccountsUpdateBody,
  type DashboardOrganizationsServiceAccountsUpdateOutput
} from '../resources';

/**
 * @name Service Account controller
 * @description Create and manage service accounts for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsServiceAccountsEndpoint {
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
   * @name List organization service accounts
   * @description Returns a paginated list of service accounts owned by the organization.
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsServiceAccountsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsServiceAccountsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsListOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsServiceAccountsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsServiceAccountsListOutput
    );
  }

  /**
   * @name Get organization service account
   * @description Retrieves a specific service account owned by the organization.
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    serviceAccountId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsServiceAccountsGetOutput
    );
  }

  /**
   * @name Create organization service account
   * @description Creates a new service account for machine-to-machine authentication.
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsServiceAccountsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsServiceAccountsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts`;

    let request = {
      path,
      body: mapDashboardOrganizationsServiceAccountsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsServiceAccountsCreateOutput
    );
  }

  /**
   * @name Update organization service account
   * @description Updates an existing service account owned by the organization.
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `body` - DashboardOrganizationsServiceAccountsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    serviceAccountId: string,
    body: DashboardOrganizationsServiceAccountsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsServiceAccountsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsServiceAccountsUpdateOutput
    );
  }

  /**
   * @name Delete organization service account
   * @description Archives a service account owned by the organization.
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    serviceAccountId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsServiceAccountsDeleteOutput
    );
  }
}
