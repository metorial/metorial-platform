import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsJoinAcceptBody,
  mapDashboardOrganizationsJoinAcceptOutput,
  mapDashboardOrganizationsJoinGetOutput,
  mapDashboardOrganizationsJoinGetQuery,
  mapDashboardOrganizationsJoinRejectBody,
  mapDashboardOrganizationsJoinRejectOutput,
  type DashboardOrganizationsJoinAcceptBody,
  type DashboardOrganizationsJoinAcceptOutput,
  type DashboardOrganizationsJoinGetOutput,
  type DashboardOrganizationsJoinGetQuery,
  type DashboardOrganizationsJoinRejectBody,
  type DashboardOrganizationsJoinRejectOutput
} from '../resources';

/**
 * @name Organization controller
 * @description Read and write organization information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsJoinEndpoint {
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
   * @name Join organization
   * @description Join an organization
   *
   * @param `query` - DashboardOrganizationsJoinGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsJoinGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    query?: DashboardOrganizationsJoinGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsJoinGetOutput> {
    let path = 'dashboard/organization-join/find';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsJoinGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardOrganizationsJoinGetOutput);
  }

  /**
   * @name Join organization
   * @description Join an organization
   *
   * @param `body` - DashboardOrganizationsJoinAcceptBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsJoinAcceptOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  accept(
    body: DashboardOrganizationsJoinAcceptBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsJoinAcceptOutput> {
    let path = 'dashboard/organization-join/accept';

    let request = {
      path,
      body: mapDashboardOrganizationsJoinAcceptBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsJoinAcceptOutput
    );
  }

  /**
   * @name Reject organization invite
   * @description Reject an organization invite
   *
   * @param `body` - DashboardOrganizationsJoinRejectBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsJoinRejectOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reject(
    body: DashboardOrganizationsJoinRejectBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsJoinRejectOutput> {
    let path = 'dashboard/organization-join/reject';

    let request = {
      path,
      body: mapDashboardOrganizationsJoinRejectBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsJoinRejectOutput
    );
  }
}
