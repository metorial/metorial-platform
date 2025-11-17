import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsMessagesGetOutput,
  mapDashboardInstanceSessionsMessagesListOutput,
  mapDashboardInstanceSessionsMessagesListQuery,
  type DashboardInstanceSessionsMessagesGetOutput,
  type DashboardInstanceSessionsMessagesListOutput,
  type DashboardInstanceSessionsMessagesListQuery
} from '../resources';

/**
 * @name Session Message controller
 * @description When MCP servers and clients communicate, Metorial captures the messages they send. This allows you to see the raw messages exchanged between the server and client, which can be useful for debugging or understanding the communication flow.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsMessagesEndpoint {
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
   * @name List session messages
   * @description List all messages for a specific session
   *
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsMessagesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsMessagesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    sessionId: string,
    query?: DashboardInstanceSessionsMessagesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsMessagesListOutput> {
    let path = `sessions/${sessionId}/messages`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsMessagesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsMessagesListOutput
    );
  }

  /**
   * @name Get session message
   * @description Get details of a specific session message
   *
   * @param `sessionId` - string
   * @param `sessionMessageId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsMessagesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    sessionMessageId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsMessagesGetOutput> {
    let path = `sessions/${sessionId}/messages/${sessionMessageId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsMessagesGetOutput
    );
  }
}
