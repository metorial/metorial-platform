import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConsumerSurfacesGetOutput,
  mapDashboardInstanceConsumerSurfacesListOutput,
  mapDashboardInstanceConsumerSurfacesListQuery,
  type DashboardInstanceConsumerSurfacesGetOutput,
  type DashboardInstanceConsumerSurfacesListOutput,
  type DashboardInstanceConsumerSurfacesListQuery
} from '../resources';

/**
 * @name Consumer Surfaces controller
 * @description A consumer surface is a portal, member directory, or CLI entry point consumers sign in through.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceConsumerSurfacesEndpoint {
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
   * @name List consumer surfaces
   * @description Returns a paginated list of consumer surfaces.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceConsumerSurfacesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerSurfacesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceConsumerSurfacesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerSurfacesListOutput> {
    let path = `dashboard/instances/${instanceId}/consumer-surfaces`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceConsumerSurfacesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumerSurfacesListOutput
    );
  }

  /**
   * @name Get consumer surface
   * @description Retrieves a consumer surface.
   *
   * @param `instanceId` - string
   * @param `consumerSurfaceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerSurfacesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    consumerSurfaceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerSurfacesGetOutput> {
    let path = `dashboard/instances/${instanceId}/consumer-surfaces/${consumerSurfaceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumerSurfacesGetOutput
    );
  }
}
