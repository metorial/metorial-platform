import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingToolCallSessionsListOutput,
  mapDashboardInstanceAgentTrackingToolCallSessionsListQuery,
  type DashboardInstanceAgentTrackingToolCallSessionsListOutput,
  type DashboardInstanceAgentTrackingToolCallSessionsListQuery
} from '../resources';

/**
 * @name Agent Tracking Tool Call Sessions controller
 * @description A tool call session links a tool call to the agent session of the AI coding agent that made it.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialAgentTrackingToolCallSessionsEndpoint {
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
   * @name List tool call sessions
   * @description Returns the agent session of each of the given tool calls, in the order given. Tool calls without a known agent session are left out. Refused when the organization hides individual data.
   *
   * @param `query` - DashboardInstanceAgentTrackingToolCallSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingToolCallSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceAgentTrackingToolCallSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingToolCallSessionsListOutput> {
    let path = 'agent-tracking/tool-call-sessions';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingToolCallSessionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingToolCallSessionsListOutput
    );
  }
}
