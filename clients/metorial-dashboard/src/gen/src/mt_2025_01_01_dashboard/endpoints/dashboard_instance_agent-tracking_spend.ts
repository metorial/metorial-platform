import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingSpendBreakdownOutput,
  mapDashboardInstanceAgentTrackingSpendBreakdownQuery,
  mapDashboardInstanceAgentTrackingSpendTimelineOutput,
  mapDashboardInstanceAgentTrackingSpendTimelineQuery,
  type DashboardInstanceAgentTrackingSpendBreakdownOutput,
  type DashboardInstanceAgentTrackingSpendBreakdownQuery,
  type DashboardInstanceAgentTrackingSpendTimelineOutput,
  type DashboardInstanceAgentTrackingSpendTimelineQuery
} from '../resources';

/**
 * @name Agent Tracking Spend controller
 * @description What AI coding agents cost, over time and by member or model.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingSpendEndpoint {
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
   * @name Get spend timeline
   * @description Returns the cost, tokens, active sessions and active members of the instance per day over a range, with the totals of the range and the period before it. Filters apply to all of them. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingSpendTimelineQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSpendTimelineOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  timeline(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingSpendTimelineQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSpendTimelineOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/spend/timeline`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingSpendTimelineQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingSpendTimelineOutput
    );
  }

  /**
   * @name Get spend breakdown
   * @description Returns the cost of the instance over a range by member or by model: the top 10 with their share of the total, then everything else as one item. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingSpendBreakdownQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSpendBreakdownOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  breakdown(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingSpendBreakdownQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSpendBreakdownOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/spend/breakdown`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingSpendBreakdownQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingSpendBreakdownOutput
    );
  }
}
