import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePortalsConsumerAuthFactorsCreateBody,
  mapDashboardInstancePortalsConsumerAuthFactorsCreateOutput,
  mapDashboardInstancePortalsConsumerAuthFactorsDeleteOutput,
  mapDashboardInstancePortalsConsumerAuthFactorsGetOutput,
  mapDashboardInstancePortalsConsumerAuthFactorsListOutput,
  mapDashboardInstancePortalsConsumerAuthFactorsListQuery,
  mapDashboardInstancePortalsConsumerAuthFactorsUpdateBody,
  mapDashboardInstancePortalsConsumerAuthFactorsUpdateOutput,
  type DashboardInstancePortalsConsumerAuthFactorsCreateBody,
  type DashboardInstancePortalsConsumerAuthFactorsCreateOutput,
  type DashboardInstancePortalsConsumerAuthFactorsDeleteOutput,
  type DashboardInstancePortalsConsumerAuthFactorsGetOutput,
  type DashboardInstancePortalsConsumerAuthFactorsListOutput,
  type DashboardInstancePortalsConsumerAuthFactorsListQuery,
  type DashboardInstancePortalsConsumerAuthFactorsUpdateBody,
  type DashboardInstancePortalsConsumerAuthFactorsUpdateOutput
} from '../resources';

/**
 * @name Portal Auth controller
 * @description Connect various authentication factors to your portal instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePortalsConsumerAuthFactorsEndpoint {
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
   * @param `query` - DashboardInstancePortalsConsumerAuthFactorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAuthFactorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    portalId: string,
    query?: DashboardInstancePortalsConsumerAuthFactorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAuthFactorsListOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth-factors`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePortalsConsumerAuthFactorsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAuthFactorsListOutput
    );
  }

  /**
   * @name Get Auth by ID
   * @description Retrieves details for a specific portal by its ID.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAuthFactorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAuthFactorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    portalId: string,
    consumerAuthFactorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAuthFactorsGetOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth-factors/${consumerAuthFactorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePortalsConsumerAuthFactorsGetOutput
    );
  }

  /**
   * @name Create Auth
   * @description Creates a new sso tenant for the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `body` - DashboardInstancePortalsConsumerAuthFactorsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAuthFactorsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    portalId: string,
    body: DashboardInstancePortalsConsumerAuthFactorsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAuthFactorsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth-factors`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerAuthFactorsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePortalsConsumerAuthFactorsCreateOutput
    );
  }

  /**
   * @name Delete Portal
   * @description Deletes a portal from the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAuthFactorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAuthFactorsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    portalId: string,
    consumerAuthFactorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAuthFactorsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth-factors/${consumerAuthFactorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePortalsConsumerAuthFactorsDeleteOutput
    );
  }

  /**
   * @name Update Portal
   * @description Updates a portal from the instance.
   *
   * @param `instanceId` - string
   * @param `portalId` - string
   * @param `consumerAuthFactorId` - string
   * @param `body` - DashboardInstancePortalsConsumerAuthFactorsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePortalsConsumerAuthFactorsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    portalId: string,
    consumerAuthFactorId: string,
    body: DashboardInstancePortalsConsumerAuthFactorsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePortalsConsumerAuthFactorsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/portals/${portalId}/auth-factors/${consumerAuthFactorId}`;

    let request = {
      path,
      body: mapDashboardInstancePortalsConsumerAuthFactorsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePortalsConsumerAuthFactorsUpdateOutput
    );
  }
}
