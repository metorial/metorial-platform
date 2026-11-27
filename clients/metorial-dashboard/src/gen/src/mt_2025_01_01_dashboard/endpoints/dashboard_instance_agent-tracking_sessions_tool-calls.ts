import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingSessionsToolCallsListOutput,
  type DashboardInstanceAgentTrackingSessionsToolCallsListOutput
} from '../resources';

/**
 * @name Agent Tracking Session Tool Calls controller
 * @description Agent session tool calls are the MCP tool calls an AI coding agent made in an agent session that went through Metorial, each matched to the tool call Metorial recorded.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingSessionsToolCallsEndpoint {
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
   * @name List agent session tool calls
   * @description Returns the Metorial tool calls you can see that an agent session made, oldest first, and how many of its MCP tool calls are not linked to one. Refused when the organization hides individual data.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSessionsToolCallsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSessionsToolCallsListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/agent-tracking/sessions/${encodeURIComponent(sessionId)}/tool-calls`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingSessionsToolCallsListOutput
    );
  }
}
