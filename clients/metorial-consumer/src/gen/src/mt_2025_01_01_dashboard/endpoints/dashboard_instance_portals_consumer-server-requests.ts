import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerServerRequestsAcceptBody,
  mapDashboardInstancePortalsConsumerServerRequestsAcceptOutput,
  mapDashboardInstancePortalsConsumerServerRequestsGetOutput,
  mapDashboardInstancePortalsConsumerServerRequestsListOutput,
  mapDashboardInstancePortalsConsumerServerRequestsListQuery,
  mapDashboardInstancePortalsConsumerServerRequestsRejectBody,
  mapDashboardInstancePortalsConsumerServerRequestsRejectOutput,
  type DashboardInstancePortalsConsumerServerRequestsAcceptBody,
  type DashboardInstancePortalsConsumerServerRequestsAcceptOutput,
  type DashboardInstancePortalsConsumerServerRequestsGetOutput,
  type DashboardInstancePortalsConsumerServerRequestsListOutput,
  type DashboardInstancePortalsConsumerServerRequestsListQuery,
  type DashboardInstancePortalsConsumerServerRequestsRejectBody,
  type DashboardInstancePortalsConsumerServerRequestsRejectOutput
} from '../resources';

/**
 * @name Portal Consumer Server Requests controller
 * @description Connect Magic MCP Groups to Portals to control access to your marketplaces.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsConsumerServerRequestsEndpoint {
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
   * @name List Portal
   * @description Returns a paginated list of portals.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `query` - DashboardInstancePortalsConsumerServerRequestsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerServerRequestsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsConsumerServerRequestsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerServerRequestsListOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-server-requests`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerServerRequestsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerServerRequestsListOutput
    );
  }

  /**
   * @name Get Portal Consumer Server Request by ID
   * @description Retrieves details for a specific portal by its ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerServerRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerServerRequestsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerServerRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerServerRequestsGetOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-server-requests/${consumerServerRequestId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerServerRequestsGetOutput
    );
  }

  /**
   * @name Create Portal Consumer Server Request
   * @description Creates a new sso tenant for the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerServerRequestId` - string
   * @param `body` - DashboardInstancePortalsConsumerServerRequestsAcceptBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerServerRequestsAcceptOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  accept(
    instanceId: string,
    portalId: string,
    consumerServerRequestId: string,
    body: DashboardInstancePortalsConsumerServerRequestsAcceptBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerServerRequestsAcceptOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-server-requests/${consumerServerRequestId}/accept`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerServerRequestsAcceptBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerServerRequestsAcceptOutput
    );
  }

  /**
   * @name Reject Portal Consumer Server Request
   * @description Rejects a pending consumer server request.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerServerRequestId` - string
   * @param `body` - DashboardInstancePortalsConsumerServerRequestsRejectBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerServerRequestsRejectOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reject(
    instanceId: string,
    portalId: string,
    consumerServerRequestId: string,
    body: DashboardInstancePortalsConsumerServerRequestsRejectBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerServerRequestsRejectOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-server-requests/${consumerServerRequestId}/reject`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerServerRequestsRejectBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerServerRequestsRejectOutput
    );
  }
}
