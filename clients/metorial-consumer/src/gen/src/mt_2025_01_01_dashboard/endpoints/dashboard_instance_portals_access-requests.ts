import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsAccessRequestsGetOutput,
  mapDashboardInstancePortalsAccessRequestsListOutput,
  mapDashboardInstancePortalsAccessRequestsListQuery,
  mapDashboardInstancePortalsAccessRequestsUpdateBody,
  mapDashboardInstancePortalsAccessRequestsUpdateOutput,
  type DashboardInstancePortalsAccessRequestsGetOutput,
  type DashboardInstancePortalsAccessRequestsListOutput,
  type DashboardInstancePortalsAccessRequestsListQuery,
  type DashboardInstancePortalsAccessRequestsUpdateBody,
  type DashboardInstancePortalsAccessRequestsUpdateOutput
} from '../resources';

/**
 * @name Portal Consumer Access Requests controller
 * @description Review and resolve consumer access requests for a portal.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsAccessRequestsEndpoint {
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
   * @name List portal consumer access requests
   * @description Returns a paginated list of consumer access requests for a portal.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsAccessRequestsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessRequestsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsAccessRequestsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessRequestsListOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access-requests`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsAccessRequestsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAccessRequestsListOutput
    );
  }

  /**
   * @name Get portal consumer access request
   * @description Retrieves a consumer access request by ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessRequestsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerAccessRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessRequestsGetOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access-requests/${consumerAccessRequestId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAccessRequestsGetOutput
    );
  }

  /**
   * @name Review portal consumer access request
   * @description Approves or rejects a consumer access request.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessRequestId` - string
   * @param `body` - DashboardInstancePortalsAccessRequestsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessRequestsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    consumerAccessRequestId: string,
    body: DashboardInstancePortalsAccessRequestsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessRequestsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/access-requests/${consumerAccessRequestId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsAccessRequestsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsAccessRequestsUpdateOutput
    );
  }
}
