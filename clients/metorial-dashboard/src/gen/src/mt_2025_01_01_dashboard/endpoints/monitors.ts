import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMonitorsGetOutput,
  mapDashboardInstanceMonitorsListOutput,
  mapDashboardInstanceMonitorsListQuery,
  type DashboardInstanceMonitorsGetOutput,
  type DashboardInstanceMonitorsListOutput,
  type DashboardInstanceMonitorsListQuery
} from '../resources';

/**
 * @name Monitors controller
 * @description Monitors track automated observability checks for this instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialMonitorsEndpoint {
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
   * @name List monitors
   * @description Returns a paginated list of monitors for this instance.
   *
   * @param `query` - DashboardInstanceMonitorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceMonitorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorsListOutput> {
    let path = 'monitors';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMonitorsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceMonitorsListOutput);
  }

  /**
   * @name Get monitor
   * @description Retrieves a monitor by ID.
   *
   * @param `monitorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    monitorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorsGetOutput> {
    let path = `monitors/${monitorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceMonitorsGetOutput);
  }
}
