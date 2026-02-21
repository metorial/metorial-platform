import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardUsageTimelineOutput,
  mapDashboardUsageTimelineQuery,
  type DashboardUsageTimelineOutput,
  type DashboardUsageTimelineQuery
} from '../resources';

/**
 * @name Usage controller
 * @description Get usage information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardUsageEndpoint {
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
   * @name Get organization
   * @description Get the current organization information
   *
   * @param `organizationId` - string
   * @param `query` - DashboardUsageTimelineQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardUsageTimelineOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  timeline(
    organizationId: string,
    query?: DashboardUsageTimelineQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardUsageTimelineOutput> {
    let path = `dashboard/organizations/${organizationId}/usage/timeline`;

    let request = {
      path,

      query: query
        ? mapDashboardUsageTimelineQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardUsageTimelineOutput);
  }
}
