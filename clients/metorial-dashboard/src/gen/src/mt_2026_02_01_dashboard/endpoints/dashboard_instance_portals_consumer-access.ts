import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerAccessCreateBody,
  mapDashboardInstancePortalsConsumerAccessCreateOutput,
  mapDashboardInstancePortalsConsumerAccessDeleteOutput,
  mapDashboardInstancePortalsConsumerAccessGetOutput,
  mapDashboardInstancePortalsConsumerAccessListOutput,
  mapDashboardInstancePortalsConsumerAccessListQuery,
  type DashboardInstancePortalsConsumerAccessCreateBody,
  type DashboardInstancePortalsConsumerAccessCreateOutput,
  type DashboardInstancePortalsConsumerAccessDeleteOutput,
  type DashboardInstancePortalsConsumerAccessGetOutput,
  type DashboardInstancePortalsConsumerAccessListOutput,
  type DashboardInstancePortalsConsumerAccessListQuery
} from '../resources';

/**
 * @name Portal Consumer Access controller
 * @description Connect Consumer Groups to Portals to control access to your marketplaces.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsConsumerAccessEndpoint {
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
   * @param `query` - DashboardInstancePortalsConsumerAccessListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsConsumerAccessListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessListOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-access`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerAccessListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAccessListOutput
    );
  }

  /**
   * @name Get Consumer Access by ID
   * @description Retrieves details for a specific portal by its ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerAccessId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessGetOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-access/${consumerAccessId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAccessGetOutput
    );
  }

  /**
   * @name Create Consumer Access
   * @description Creates a new sso tenant for the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsConsumerAccessCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsConsumerAccessCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessCreateOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-access`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerAccessCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerAccessCreateOutput
    );
  }

  /**
   * @name Delete Portal
   * @description Deletes a portal from the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAccessId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAccessDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    consumerAccessId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAccessDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/consumer-access/${consumerAccessId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsConsumerAccessDeleteOutput
    );
  }
}
