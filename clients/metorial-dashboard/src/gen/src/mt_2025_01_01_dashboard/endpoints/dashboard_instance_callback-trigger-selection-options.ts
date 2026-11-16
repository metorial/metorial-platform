import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbackTriggerSelectionOptionsListOutput,
  mapDashboardInstanceCallbackTriggerSelectionOptionsListQuery,
  type DashboardInstanceCallbackTriggerSelectionOptionsListOutput,
  type DashboardInstanceCallbackTriggerSelectionOptionsListQuery
} from '../resources';

/**
 * @name Callback Trigger Selection Options controller
 * @description The values a connected account can pick for a field of a trigger group selection.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCallbackTriggerSelectionOptionsEndpoint {
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
   * @name List callback trigger selection options
   * @description Returns a paginated list of the values a connected account can pick for one field of a trigger group selection, such as its folders. Only connections the caller may use are considered. The provider decides the page size, so `limit` is not applied, and the list can only be paged forward with `after`.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceCallbackTriggerSelectionOptionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbackTriggerSelectionOptionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceCallbackTriggerSelectionOptionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbackTriggerSelectionOptionsListOutput> {
    let path = `dashboard/instances/${instanceId}/callback-trigger-selection-options`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbackTriggerSelectionOptionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbackTriggerSelectionOptionsListOutput
    );
  }
}
