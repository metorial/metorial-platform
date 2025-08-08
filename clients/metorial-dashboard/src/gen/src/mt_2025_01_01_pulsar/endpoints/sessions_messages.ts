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
export class MetorialSessionsMessagesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List session messages
   * @description List all messages for a specific session
   *
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsMessagesListQuery
   *
   * @returns DashboardInstanceSessionsMessagesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    sessionId: string,
    query?: DashboardInstanceSessionsMessagesListQuery
  ): Promise<DashboardInstanceSessionsMessagesListOutput> {
    let path = `sessions/${sessionId}/messages`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceSessionsMessagesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsMessagesListOutput);
  }

  /**
   * @name Get session message
   * @description Get details of a specific session message
   *
   * @param `sessionId` - string
   * @param `sessionMessageId` - string
   *
   * @returns DashboardInstanceSessionsMessagesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    sessionMessageId: string
  ): Promise<DashboardInstanceSessionsMessagesGetOutput> {
    let path = `sessions/${sessionId}/messages/${sessionMessageId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceSessionsMessagesGetOutput);
  }
}
