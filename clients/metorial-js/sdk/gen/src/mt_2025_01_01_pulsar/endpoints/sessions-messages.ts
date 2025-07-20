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
 * @name SessionMessage controller
 * @description Read and write session message information
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
  list(sessionId: string, query?: DashboardInstanceSessionsMessagesListQuery) {
    return this._get({
      path: ['sessions', sessionId, 'messages'],

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
  get(sessionId: string, sessionMessageId: string) {
    return this._get({
      path: ['sessions', sessionId, 'messages', sessionMessageId]
    }).transform(mapDashboardInstanceSessionsMessagesGetOutput);
  }
}
