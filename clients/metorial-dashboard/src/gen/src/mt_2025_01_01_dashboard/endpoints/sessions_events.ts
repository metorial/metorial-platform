import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsEventsGetOutput,
  mapDashboardInstanceSessionsEventsListOutput,
  mapDashboardInstanceSessionsEventsListQuery,
  type DashboardInstanceSessionsEventsGetOutput,
  type DashboardInstanceSessionsEventsListOutput,
  type DashboardInstanceSessionsEventsListQuery
} from '../resources';

/**
 * @name Session Events controller
 * @description Session events represent significant occurrences during a session, such as errors or state changes. This read-only resource provides visibility into session activity.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsEventsEndpoint {
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
   * @name List session events
   * @description Returns a paginated list of events for a session.
   *
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    sessionId: string,
    query?: DashboardInstanceSessionsEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsEventsListOutput> {
    let path = `sessions/${sessionId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsEventsListOutput);
  }

  /**
   * @name Get session event
   * @description Retrieves a specific event from a session.
   *
   * @param `sessionId` - string
   * @param `sessionEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    sessionEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsEventsGetOutput> {
    let path = `sessions/${sessionId}/events/${sessionEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsEventsGetOutput);
  }
}
