import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOutpostsAccessListOutput,
  mapDashboardOrganizationsOutpostsAccessListQuery,
  mapDashboardOrganizationsOutpostsAccessSetBody,
  mapDashboardOrganizationsOutpostsAccessSetOutput,
  type DashboardOrganizationsOutpostsAccessListOutput,
  type DashboardOrganizationsOutpostsAccessListQuery,
  type DashboardOrganizationsOutpostsAccessSetBody,
  type DashboardOrganizationsOutpostsAccessSetOutput
} from '../resources';

/**
 * @name Outpost controller
 * @description Read and write outposts, their access grants, and credentials
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationOutpostsAccessEndpoint {
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
   * @name Set outpost access
   * @description Replace this organization’s access grants on an outpost with the given list of instance/service grants
   *
   * @param `outpostId` - string
   * @param `body` - DashboardOrganizationsOutpostsAccessSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsAccessSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    outpostId: string,
    body: DashboardOrganizationsOutpostsAccessSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsAccessSetOutput> {
    let path = `organization/outposts/${outpostId}/access`;

    let request = {
      path,
      body: mapDashboardOrganizationsOutpostsAccessSetBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOutpostsAccessSetOutput
    );
  }

  /**
   * @name List outpost access
   * @description List the access grants on an outpost, optionally filtered by organization or instance
   *
   * @param `outpostId` - string
   * @param `query` - DashboardOrganizationsOutpostsAccessListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOutpostsAccessListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    outpostId: string,
    query?: DashboardOrganizationsOutpostsAccessListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOutpostsAccessListOutput> {
    let path = `organization/outposts/${outpostId}/access`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsOutpostsAccessListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOutpostsAccessListOutput
    );
  }
}
