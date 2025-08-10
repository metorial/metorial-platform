import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsProjectsCreateBody,
  mapDashboardOrganizationsProjectsCreateOutput,
  mapDashboardOrganizationsProjectsDeleteOutput,
  mapDashboardOrganizationsProjectsGetOutput,
  mapDashboardOrganizationsProjectsListOutput,
  mapDashboardOrganizationsProjectsListQuery,
  mapDashboardOrganizationsProjectsUpdateBody,
  mapDashboardOrganizationsProjectsUpdateOutput,
  type DashboardOrganizationsProjectsCreateBody,
  type DashboardOrganizationsProjectsCreateOutput,
  type DashboardOrganizationsProjectsDeleteOutput,
  type DashboardOrganizationsProjectsGetOutput,
  type DashboardOrganizationsProjectsListOutput,
  type DashboardOrganizationsProjectsListQuery,
  type DashboardOrganizationsProjectsUpdateBody,
  type DashboardOrganizationsProjectsUpdateOutput
} from '../resources';

/**
 * @name Project controller
 * @description Read and write project information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsProjectsEndpoint {
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
   * @name List organization projects
   * @description List all organization projects
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsProjectsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsProjectsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsProjectsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsProjectsListOutput> {
    let path = `dashboard/organizations/${organizationId}/projects`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsProjectsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsProjectsListOutput
    );
  }

  /**
   * @name Get organization project
   * @description Get the information of a specific organization project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsProjectsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsProjectsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsProjectsGetOutput
    );
  }

  /**
   * @name Create organization project
   * @description Create a new organization project
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsProjectsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsProjectsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsProjectsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsProjectsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects`;

    let request = {
      path,
      body: mapDashboardOrganizationsProjectsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsProjectsCreateOutput
    );
  }

  /**
   * @name Delete organization project
   * @description Remove an organization project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsProjectsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsProjectsDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsProjectsDeleteOutput
    );
  }

  /**
   * @name Update organization project
   * @description Update the role of an organization project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardOrganizationsProjectsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsProjectsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardOrganizationsProjectsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsProjectsUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsProjectsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsProjectsUpdateOutput
    );
  }
}
