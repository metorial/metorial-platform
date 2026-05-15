import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceStoresCreateBody,
  mapDashboardInstanceStoresCreateOutput,
  mapDashboardInstanceStoresDeleteOutput,
  mapDashboardInstanceStoresGetOutput,
  mapDashboardInstanceStoresListOutput,
  mapDashboardInstanceStoresListQuery,
  mapDashboardInstanceStoresUpdateBody,
  mapDashboardInstanceStoresUpdateOutput,
  type DashboardInstanceStoresCreateBody,
  type DashboardInstanceStoresCreateOutput,
  type DashboardInstanceStoresDeleteOutput,
  type DashboardInstanceStoresGetOutput,
  type DashboardInstanceStoresListOutput,
  type DashboardInstanceStoresListQuery,
  type DashboardInstanceStoresUpdateBody,
  type DashboardInstanceStoresUpdateOutput
} from '../resources';

/**
 * @name Stores controller
 * @description Create and manage instance stores backed by Cargo.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceStoresEndpoint {
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
   * @name List stores
   * @description Returns a paginated list of stores owned by the instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceStoresListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceStoresListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresListOutput> {
    let path = `instances/${instanceId}/stores`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceStoresListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceStoresListOutput);
  }

  /**
   * @name Create store
   * @description Creates a new store for the instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceStoresCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceStoresCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresCreateOutput> {
    let path = `instances/${instanceId}/stores`;

    let request = {
      path,
      body: mapDashboardInstanceStoresCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceStoresCreateOutput
    );
  }

  /**
   * @name Get store by ID
   * @description Retrieves a store by its ID.
   *
   * @param `instanceId` - string
   * @param `storeId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    storeId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresGetOutput> {
    let path = `instances/${instanceId}/stores/${storeId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceStoresGetOutput);
  }

  /**
   * @name Update store by ID
   * @description Updates a specific store.
   *
   * @param `instanceId` - string
   * @param `storeId` - string
   * @param `body` - DashboardInstanceStoresUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    storeId: string,
    body: DashboardInstanceStoresUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresUpdateOutput> {
    let path = `instances/${instanceId}/stores/${storeId}`;

    let request = {
      path,
      body: mapDashboardInstanceStoresUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceStoresUpdateOutput
    );
  }

  /**
   * @name Delete store by ID
   * @description Deletes a specific store.
   *
   * @param `instanceId` - string
   * @param `storeId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    storeId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresDeleteOutput> {
    let path = `instances/${instanceId}/stores/${storeId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceStoresDeleteOutput
    );
  }
}
