import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingSessionsGetOutput,
  mapDashboardInstanceAgentTrackingSessionsListOutput,
  mapDashboardInstanceAgentTrackingSessionsListQuery,
  type DashboardInstanceAgentTrackingSessionsGetOutput,
  type DashboardInstanceAgentTrackingSessionsListOutput,
  type DashboardInstanceAgentTrackingSessionsListQuery
} from '../resources';

/**
 * @name Agent Tracking Sessions controller
 * @description The sessions of AI coding agents, with what each one cost.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialAgentTrackingSessionsEndpoint {
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
   * @name List agent sessions
   * @description Returns the sessions of the instance, most recently active first, or most expensive first with order_by=cost. Results can be up to 30 seconds old.
   *
   * @param `query` - DashboardInstanceAgentTrackingSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceAgentTrackingSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSessionsListOutput> {
    let path = 'agent-tracking/sessions';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingSessionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingSessionsListOutput
    );
  }

  /**
   * @name Get agent session
   * @description Returns one session of the instance with its requests, tokens and cost per model. Results can be up to 30 seconds old.
   *
   * @param `sessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingSessionsGetOutput> {
    let path = `agent-tracking/sessions/${sessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingSessionsGetOutput
    );
  }
}
