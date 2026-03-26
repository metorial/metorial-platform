import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksInstancesCreateBody,
  mapDashboardInstanceCallbacksInstancesCreateOutput,
  mapDashboardInstanceCallbacksInstancesDeleteOutput,
  mapDashboardInstanceCallbacksInstancesListOutput,
  mapDashboardInstanceCallbacksInstancesListQuery,
  type DashboardInstanceCallbacksInstancesCreateBody,
  type DashboardInstanceCallbacksInstancesCreateOutput,
  type DashboardInstanceCallbacksInstancesDeleteOutput,
  type DashboardInstanceCallbacksInstancesListOutput,
  type DashboardInstanceCallbacksInstancesListQuery
} from '../resources';

/**
 * @name Callback Instances controller
 * @description Attach or detach callback instances for a deployment/config/auth-config combination.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCallbacksInstancesEndpoint {
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
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `query` - DashboardInstanceCallbacksInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    callbackId: string,
    query?: DashboardInstanceCallbacksInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesListOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbacksInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksInstancesListOutput
    );
  }

  /**
   * @name Create callback instance
   * @description Attaches a callback to a config and optional auth config.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `body` - DashboardInstanceCallbacksInstancesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    callbackId: string,
    body: DashboardInstanceCallbacksInstancesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances`;

    let request = {
      path,
      body: mapDashboardInstanceCallbacksInstancesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksInstancesCreateOutput
    );
  }

  /**
   * @name Delete callback instance
   * @description Detaches a callback instance.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `callbackInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksInstancesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    callbackId: string,
    callbackInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksInstancesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/callbacks/${callbackId}/instances/${callbackInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceCallbacksInstancesDeleteOutput
    );
  }
}
