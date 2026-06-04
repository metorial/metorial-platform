import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancesResourceCountsGetOutput,
  mapDashboardInstancesResourceCountsGetQuery,
  type DashboardInstancesResourceCountsGetOutput,
  type DashboardInstancesResourceCountsGetQuery
} from '../resources';

/**
 * @name Resource Counts controller
 * @description Read dashboard resource counts for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancesResourceCountsEndpoint {
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
   * @name Get resource counts
   * @description Returns counts for requested dashboard resources.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstancesResourceCountsGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancesResourceCountsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    query?: DashboardInstancesResourceCountsGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancesResourceCountsGetOutput> {
    let path = `dashboard/instances/${instanceId}/resource-counts`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancesResourceCountsGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancesResourceCountsGetOutput
    );
  }
}
