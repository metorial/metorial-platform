import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsAccessRolesCreateBody,
  mapDashboardOrganizationsAccessRolesCreateOutput,
  mapDashboardOrganizationsAccessRolesDeleteOutput,
  mapDashboardOrganizationsAccessRolesGetOutput,
  mapDashboardOrganizationsAccessRolesListOutput,
  mapDashboardOrganizationsAccessRolesListQuery,
  mapDashboardOrganizationsAccessRolesUpdateBody,
  mapDashboardOrganizationsAccessRolesUpdateOutput,
  mapDashboardOrganizationsAccessRolesVersionsOutput,
  mapDashboardOrganizationsAccessRolesVersionsQuery,
  type DashboardOrganizationsAccessRolesCreateBody,
  type DashboardOrganizationsAccessRolesCreateOutput,
  type DashboardOrganizationsAccessRolesDeleteOutput,
  type DashboardOrganizationsAccessRolesGetOutput,
  type DashboardOrganizationsAccessRolesListOutput,
  type DashboardOrganizationsAccessRolesListQuery,
  type DashboardOrganizationsAccessRolesUpdateBody,
  type DashboardOrganizationsAccessRolesUpdateOutput,
  type DashboardOrganizationsAccessRolesVersionsOutput,
  type DashboardOrganizationsAccessRolesVersionsQuery
} from '../resources';

/**
 * @name Access Role controller
 * @description Manage organization access roles
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsAccessRolesEndpoint {
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
   * @name List access roles
   * @description List organization access roles
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsAccessRolesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessRolesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsAccessRolesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessRolesListOutput> {
    let path = `dashboard/organizations/${organizationId}/access-roles`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAccessRolesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAccessRolesListOutput
    );
  }

  /**
   * @name Get access role
   * @description Get a single organization access role
   *
   * @param `organizationId` - string
   * @param `accessRoleId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessRolesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    accessRoleId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessRolesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/access-roles/${accessRoleId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAccessRolesGetOutput
    );
  }

  /**
   * @name List access role versions
   * @description List version history for an organization access role
   *
   * @param `organizationId` - string
   * @param `accessRoleId` - string
   * @param `query` - DashboardOrganizationsAccessRolesVersionsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessRolesVersionsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  versions(
    organizationId: string,
    accessRoleId: string,
    query?: DashboardOrganizationsAccessRolesVersionsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessRolesVersionsOutput> {
    let path = `dashboard/organizations/${organizationId}/access-roles/${accessRoleId}/versions`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAccessRolesVersionsQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAccessRolesVersionsOutput
    );
  }

  /**
   * @name Create access role
   * @description Create an organization access role
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsAccessRolesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessRolesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsAccessRolesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessRolesCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/access-roles`;

    let request = {
      path,
      body: mapDashboardOrganizationsAccessRolesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsAccessRolesCreateOutput
    );
  }

  /**
   * @name Update access role
   * @description Update an organization access role
   *
   * @param `organizationId` - string
   * @param `accessRoleId` - string
   * @param `body` - DashboardOrganizationsAccessRolesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessRolesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    accessRoleId: string,
    body: DashboardOrganizationsAccessRolesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessRolesUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/access-roles/${accessRoleId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsAccessRolesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsAccessRolesUpdateOutput
    );
  }

  /**
   * @name Delete access role
   * @description Delete an organization access role
   *
   * @param `organizationId` - string
   * @param `accessRoleId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAccessRolesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    accessRoleId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAccessRolesDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/access-roles/${accessRoleId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsAccessRolesDeleteOutput
    );
  }
}
