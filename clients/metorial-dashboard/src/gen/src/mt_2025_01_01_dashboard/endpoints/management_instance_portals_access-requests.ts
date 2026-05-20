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
 * @name Portal Access Requests controller
 * @description Review and resolve access requests for a portal.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePortalsAccessRequestsEndpoint {
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
   * @name List portal access requests
   * @description Returns a paginated list of access requests for a portal.
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
    let path = `instances/${instanceId}/portals/${portalId}/access-requests`;

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
   * @name Get portal access request
   * @description Retrieves a access request by ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `accessRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessRequestsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    accessRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessRequestsGetOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/access-requests/${accessRequestId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsAccessRequestsGetOutput
    );
  }

  /**
   * @name Review portal access request
   * @description Approves or rejects a access request.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `accessRequestId` - string
   * @param `body` - DashboardInstancePortalsAccessRequestsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsAccessRequestsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    accessRequestId: string,
    body: DashboardInstancePortalsAccessRequestsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsAccessRequestsUpdateOutput> {
    let path = `instances/${instanceId}/portals/${portalId}/access-requests/${accessRequestId}`;

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
