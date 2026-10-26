import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancesUsageSummaryOutput,
  mapDashboardInstancesUsageSummaryQuery,
  mapDashboardInstancesUsageTimelineOutput,
  mapDashboardInstancesUsageTimelineQuery,
  type DashboardInstancesUsageSummaryOutput,
  type DashboardInstancesUsageSummaryQuery,
  type DashboardInstancesUsageTimelineOutput,
  type DashboardInstancesUsageTimelineQuery
} from '../resources';

/**
 * @name Instance Usage controller
 * @description Read aggregated usage metrics for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancesUsageEndpoint {
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
   * @name Get instance usage timeline
   * @description Returns bucketed usage metrics for the instance over a time range.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstancesUsageTimelineQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancesUsageTimelineOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  timeline(
    instanceId: string,
    query?: DashboardInstancesUsageTimelineQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancesUsageTimelineOutput> {
    let path = `dashboard/instances/${instanceId}/usage/timeline`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancesUsageTimelineQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancesUsageTimelineOutput
    );
  }

  /**
   * @name Get instance usage summary
   * @description Returns usage totals for the instance over a time range.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstancesUsageSummaryQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancesUsageSummaryOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  summary(
    instanceId: string,
    query?: DashboardInstancesUsageSummaryQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancesUsageSummaryOutput> {
    let path = `dashboard/instances/${instanceId}/usage/summary`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancesUsageSummaryQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancesUsageSummaryOutput
    );
  }
}
