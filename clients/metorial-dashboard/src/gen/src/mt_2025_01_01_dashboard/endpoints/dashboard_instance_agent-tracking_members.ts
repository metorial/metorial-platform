import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingMembersInsightsOutput,
  mapDashboardInstanceAgentTrackingMembersInsightsQuery,
  mapDashboardInstanceAgentTrackingMembersListOutput,
  mapDashboardInstanceAgentTrackingMembersListQuery,
  type DashboardInstanceAgentTrackingMembersInsightsOutput,
  type DashboardInstanceAgentTrackingMembersInsightsQuery,
  type DashboardInstanceAgentTrackingMembersListOutput,
  type DashboardInstanceAgentTrackingMembersListQuery
} from '../resources';

/**
 * @name Agent Tracking Members controller
 * @description The people who have sent usage from AI coding agents.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingMembersEndpoint {
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
   * @name List members seen
   * @description Returns the members with sessions in this instance last active in the range (the last 400 days without one), most recently active first, with whether each matched a Metorial member and the sessions and cost of those sessions. Pages by item id. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingMembersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingMembersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingMembersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingMembersListOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/members`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingMembersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentTrackingMembersListOutput);
  }

  /**
   * @name List member insights
   * @description Returns the members of this instance ranked over a range by cost or another figure, with optional model usage, practices and seat columns, flags for the thresholds passed, and instance totals. Ranks at most 2000 members. Practices and seat need a range of at most 90 days. Pages by item id. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingMembersInsightsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingMembersInsightsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  insights(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingMembersInsightsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingMembersInsightsOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/members/insights`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingMembersInsightsQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingMembersInsightsOutput
    );
  }
}
