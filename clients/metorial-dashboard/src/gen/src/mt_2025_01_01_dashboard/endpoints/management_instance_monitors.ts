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
 * @description A monitor is an automated observability check for an instance. It raises alerts when its target misbehaves.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceMonitorsEndpoint {
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
   * @description Returns a paginated list of monitors in the instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceMonitorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceMonitorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorsListOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/monitors`;

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
   * @description Retrieves a monitor.
   *
   * @param `instanceId` - string
   * @param `monitorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    monitorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorsGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/monitors/${encodeURIComponent(monitorId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceMonitorsGetOutput);
  }
}
