import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxMachinesUsageSummaryOutput,
  mapDashboardInstanceSandboxMachinesUsageSummaryQuery,
  mapDashboardInstanceSandboxMachinesUsageTimelineOutput,
  mapDashboardInstanceSandboxMachinesUsageTimelineQuery,
  type DashboardInstanceSandboxMachinesUsageSummaryOutput,
  type DashboardInstanceSandboxMachinesUsageSummaryQuery,
  type DashboardInstanceSandboxMachinesUsageTimelineOutput,
  type DashboardInstanceSandboxMachinesUsageTimelineQuery
} from '../resources';

/**
 * @name Sandbox machine usage history controller
 * @description Aggregated measured CPU, memory, network, disk I/O, and observed runtime. History is flushed approximately every minute and is not billing consumption.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSandboxMachinesUsageEndpoint {
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
   * @name Get sandbox machine usage timeline
   * @description Returns chronological usage buckets. Minute data is retained for 7 days and hourly data for 30 days. Zero samples means no observations, not necessarily a stopped machine.
   *
   * @param `machineId` - string
   * @param `query` - DashboardInstanceSandboxMachinesUsageTimelineQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesUsageTimelineOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  timeline(
    machineId: string,
    query?: DashboardInstanceSandboxMachinesUsageTimelineQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesUsageTimelineOutput> {
    let path = `sandbox/machines/${machineId}/usage/timeline`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesUsageTimelineQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesUsageTimelineOutput
    );
  }

  /**
   * @name Get sandbox machine usage summary
   * @description Returns totals and averages for a range. Summary bounds align independently to minute or hour source buckets. Use a timeline’s effective bounds to compare its totals with a summary.
   *
   * @param `machineId` - string
   * @param `query` - DashboardInstanceSandboxMachinesUsageSummaryQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxMachinesUsageSummaryOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  summary(
    machineId: string,
    query?: DashboardInstanceSandboxMachinesUsageSummaryQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxMachinesUsageSummaryOutput> {
    let path = `sandbox/machines/${machineId}/usage/summary`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxMachinesUsageSummaryQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxMachinesUsageSummaryOutput
    );
  }
}
