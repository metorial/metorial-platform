import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksGetOutput,
  mapDashboardInstanceCallbacksListOutput,
  mapDashboardInstanceCallbacksListQuery,
  type DashboardInstanceCallbacksGetOutput,
  type DashboardInstanceCallbacksListOutput,
  type DashboardInstanceCallbacksListQuery
} from '../resources';

/**
 * @name Callbacks controller
 * @description Manage webhook-style callbacks backed by subspace trigger receivers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCallbacksEndpoint {
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
   * @name List callbacks
   * @description Returns a paginated list of callbacks.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceCallbacksListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceCallbacksListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksListOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbacksListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksListOutput
    );
  }

  /**
   * @name Get callback
   * @description Retrieves a specific callback by ID.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    callbackId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksGetOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceCallbacksGetOutput);
  }
}
