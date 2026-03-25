import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksCreateBody,
  mapDashboardInstanceCallbacksCreateOutput,
  mapDashboardInstanceCallbacksDeleteOutput,
  mapDashboardInstanceCallbacksGetOutput,
  mapDashboardInstanceCallbacksListOutput,
  mapDashboardInstanceCallbacksListQuery,
  mapDashboardInstanceCallbacksUpdateBody,
  mapDashboardInstanceCallbacksUpdateOutput,
  type DashboardInstanceCallbacksCreateBody,
  type DashboardInstanceCallbacksCreateOutput,
  type DashboardInstanceCallbacksDeleteOutput,
  type DashboardInstanceCallbacksGetOutput,
  type DashboardInstanceCallbacksListOutput,
  type DashboardInstanceCallbacksListQuery,
  type DashboardInstanceCallbacksUpdateBody,
  type DashboardInstanceCallbacksUpdateOutput
} from '../resources';

/**
 * @name Callbacks controller
 * @description Manage webhook-style callbacks backed by subspace trigger receivers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceCallbacksEndpoint {
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
    let path = `instances/${instanceId}/callbacks`;

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
    let path = `instances/${instanceId}/callbacks/${callbackId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceCallbacksGetOutput);
  }

  /**
   * @name Create callback
   * @description Creates a new callback definition.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceCallbacksCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceCallbacksCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksCreateOutput> {
    let path = `instances/${instanceId}/callbacks`;

    let request = {
      path,
      body: mapDashboardInstanceCallbacksCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCallbacksCreateOutput
    );
  }

  /**
   * @name Update callback
   * @description Updates a callback definition.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `body` - DashboardInstanceCallbacksUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    callbackId: string,
    body: DashboardInstanceCallbacksUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksUpdateOutput> {
    let path = `instances/${instanceId}/callbacks/${callbackId}`;

    let request = {
      path,
      body: mapDashboardInstanceCallbacksUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceCallbacksUpdateOutput
    );
  }

  /**
   * @name Delete callback
   * @description Archives a callback definition.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    callbackId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksDeleteOutput> {
    let path = `instances/${instanceId}/callbacks/${callbackId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceCallbacksDeleteOutput
    );
  }
}
