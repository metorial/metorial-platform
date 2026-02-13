import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsInstancesCreateBody,
  mapDashboardOrganizationsInstancesCreateOutput,
  mapDashboardOrganizationsInstancesDeleteOutput,
  mapDashboardOrganizationsInstancesGetOutput,
  mapDashboardOrganizationsInstancesListOutput,
  mapDashboardOrganizationsInstancesListQuery,
  mapDashboardOrganizationsInstancesUpdateBody,
  mapDashboardOrganizationsInstancesUpdateOutput,
  type DashboardOrganizationsInstancesCreateBody,
  type DashboardOrganizationsInstancesCreateOutput,
  type DashboardOrganizationsInstancesDeleteOutput,
  type DashboardOrganizationsInstancesGetOutput,
  type DashboardOrganizationsInstancesListOutput,
  type DashboardOrganizationsInstancesListQuery,
  type DashboardOrganizationsInstancesUpdateBody,
  type DashboardOrganizationsInstancesUpdateOutput
} from '../resources';

/**
 * @name Instance controller
 * @description Read and write instance information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsInstancesEndpoint {
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
   * @name List organization instances
   * @description List all organization instances
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInstancesListOutput> {
    let path = `dashboard/organizations/${organizationId}/instances`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsInstancesListOutput
    );
  }

  /**
   * @name Get organization instance
   * @description Get the information of a specific organization instance
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInstancesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/instances/${instanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsInstancesGetOutput
    );
  }

  /**
   * @name Create organization instance
   * @description Create a new organization instance
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsInstancesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInstancesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsInstancesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInstancesCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/instances`;

    let request = {
      path,
      body: mapDashboardOrganizationsInstancesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsInstancesCreateOutput
    );
  }

  /**
   * @name Delete organization instance
   * @description Remove an organization instance
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInstancesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInstancesDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/instances/${instanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsInstancesDeleteOutput
    );
  }

  /**
   * @name Update organization instance
   * @description Update the role of an organization instance
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   * @param `body` - DashboardOrganizationsInstancesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInstancesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    instanceId: string,
    body: DashboardOrganizationsInstancesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInstancesUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/instances/${instanceId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsInstancesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsInstancesUpdateOutput
    );
  }
}
