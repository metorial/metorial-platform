import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbackInstancesGetOutput,
  mapDashboardInstanceCallbackInstancesListOutput,
  mapDashboardInstanceCallbackInstancesListQuery,
  type DashboardInstanceCallbackInstancesGetOutput,
  type DashboardInstanceCallbackInstancesListOutput,
  type DashboardInstanceCallbackInstancesListQuery
} from '../resources';

/**
 * @name Callback Instances controller
 * @description A callback instance is a callback as it applies to one integration instance provider. Metorial reconciles one for every matching integration instance, so these are read-only.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCallbackInstancesEndpoint {
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
   * @name List callback instances
   * @description Returns a paginated list of callback instances.
   *
   * @param `query` - DashboardInstanceCallbackInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbackInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceCallbackInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbackInstancesListOutput> {
    let path = 'callback-instances';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbackInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbackInstancesListOutput
    );
  }

  /**
   * @name Get callback instance
   * @description Retrieves a specific callback instance by ID.
   *
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbackInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbackInstancesGetOutput> {
    let path = `callback-instances/${callbackInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbackInstancesGetOutput
    );
  }
}
