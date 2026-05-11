import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceStoresItemsGetOutput,
  mapDashboardInstanceStoresItemsListOutput,
  mapDashboardInstanceStoresItemsListQuery,
  mapDashboardInstanceStoresItemsModifyBody,
  mapDashboardInstanceStoresItemsModifyOutput,
  type DashboardInstanceStoresItemsGetOutput,
  type DashboardInstanceStoresItemsListOutput,
  type DashboardInstanceStoresItemsListQuery,
  type DashboardInstanceStoresItemsModifyBody,
  type DashboardInstanceStoresItemsModifyOutput
} from '../resources';

/**
 * @name Stores controller
 * @description Create and manage instance stores backed by Cargo.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialStoresItemsEndpoint {
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
   * @name Modify store items
   * @description Applies bulk item operations to a specific store.
   *
   * @param `storeId` - string
   * @param `body` - DashboardInstanceStoresItemsModifyBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresItemsModifyOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  modify(
    storeId: string,
    body: DashboardInstanceStoresItemsModifyBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresItemsModifyOutput> {
    let path = `stores/${storeId}/items`;

    let request = {
      path,
      body: mapDashboardInstanceStoresItemsModifyBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceStoresItemsModifyOutput
    );
  }

  /**
   * @name List store items
   * @description Returns a paginated list of items for a specific store.
   *
   * @param `storeId` - string
   * @param `query` - DashboardInstanceStoresItemsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresItemsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    storeId: string,
    query?: DashboardInstanceStoresItemsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresItemsListOutput> {
    let path = `stores/${storeId}/items`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceStoresItemsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceStoresItemsListOutput
    );
  }

  /**
   * @name Get store item by ID
   * @description Retrieves a specific item within a store.
   *
   * @param `storeId` - string
   * @param `itemId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceStoresItemsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    storeId: string,
    itemId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceStoresItemsGetOutput> {
    let path = `stores/${storeId}/items/${itemId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceStoresItemsGetOutput
    );
  }
}
