import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsAccessPoliciesCreateBody,
  mapDashboardOrganizationsAccessPoliciesCreateOutput,
  mapDashboardOrganizationsAccessPoliciesDeleteOutput,
  mapDashboardOrganizationsAccessPoliciesGetOutput,
  mapDashboardOrganizationsAccessPoliciesListOutput,
  mapDashboardOrganizationsAccessPoliciesListQuery,
  mapDashboardOrganizationsAccessPoliciesUpdateBody,
  mapDashboardOrganizationsAccessPoliciesUpdateOutput,
  mapDashboardOrganizationsAccessPoliciesVersionsOutput,
  mapDashboardOrganizationsAccessPoliciesVersionsQuery,
  type DashboardOrganizationsAccessPoliciesCreateBody,
  type DashboardOrganizationsAccessPoliciesCreateOutput,
  type DashboardOrganizationsAccessPoliciesDeleteOutput,
  type DashboardOrganizationsAccessPoliciesGetOutput,
  type DashboardOrganizationsAccessPoliciesListOutput,
  type DashboardOrganizationsAccessPoliciesListQuery,
  type DashboardOrganizationsAccessPoliciesUpdateBody,
  type DashboardOrganizationsAccessPoliciesUpdateOutput,
  type DashboardOrganizationsAccessPoliciesVersionsOutput,
  type DashboardOrganizationsAccessPoliciesVersionsQuery
} from '../resources';

/**
 * @name Access Policy controller
 * @description Manage organization access policies
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsAccessPoliciesEndpoint {
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
   * @name List access policies
   * @description List organization access policies
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsAccessPoliciesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessPoliciesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsAccessPoliciesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessPoliciesListOutput> {
    let path = `dashboard/organizations/${organizationId}/access-policies`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAccessPoliciesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAccessPoliciesListOutput
    );
  }

  /**
   * @name Get access policy
   * @description Get a single organization access policy
   *
   * @param `organizationId` - string
   * @param `accessPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessPoliciesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    accessPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessPoliciesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/access-policies/${accessPolicyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAccessPoliciesGetOutput
    );
  }

  /**
   * @name List access policy versions
   * @description List version history for an organization access policy
   *
   * @param `organizationId` - string
   * @param `accessPolicyId` - string
   * @param `query` - DashboardOrganizationsAccessPoliciesVersionsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessPoliciesVersionsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  versions(
    organizationId: string,
    accessPolicyId: string,
    query?: DashboardOrganizationsAccessPoliciesVersionsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessPoliciesVersionsOutput> {
    let path = `dashboard/organizations/${organizationId}/access-policies/${accessPolicyId}/versions`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAccessPoliciesVersionsQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAccessPoliciesVersionsOutput
    );
  }

  /**
   * @name Create access policy
   * @description Create an organization access policy
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsAccessPoliciesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessPoliciesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsAccessPoliciesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessPoliciesCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/access-policies`;

    let request = {
      path,
      body: mapDashboardOrganizationsAccessPoliciesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsAccessPoliciesCreateOutput
    );
  }

  /**
   * @name Update access policy
   * @description Update an organization access policy
   *
   * @param `organizationId` - string
   * @param `accessPolicyId` - string
   * @param `body` - DashboardOrganizationsAccessPoliciesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessPoliciesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    accessPolicyId: string,
    body: DashboardOrganizationsAccessPoliciesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessPoliciesUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/access-policies/${accessPolicyId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsAccessPoliciesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsAccessPoliciesUpdateOutput
    );
  }

  /**
   * @name Delete access policy
   * @description Delete an organization access policy
   *
   * @param `organizationId` - string
   * @param `accessPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessPoliciesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    accessPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessPoliciesDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/access-policies/${accessPolicyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsAccessPoliciesDeleteOutput
    );
  }
}
