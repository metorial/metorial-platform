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
 * @description List and retrieve consumer surfaces for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerSurfacesEndpoint {
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
   * @description Returns a paginated list of consumer surfaces for an instance.
   *
   * @param `query` - DashboardInstanceConsumerSurfacesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerSurfacesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceConsumerSurfacesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerSurfacesListOutput> {
    let path = 'consumer-surfaces';

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
   * @description Retrieves a consumer surface by ID.
   *
   * @param `consumerSurfaceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerSurfacesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    consumerSurfaceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerSurfacesGetOutput> {
    let path = `consumer-surfaces/${consumerSurfaceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumerSurfacesGetOutput
    );
  }
}
