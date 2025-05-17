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
 * @description Read and write session message information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionsMessagesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List session messages
   * @description List all session messages
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsMessagesListQuery
   *
   * @returns DashboardInstanceSessionsMessagesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    query?: DashboardInstanceSessionsMessagesListQuery
  ) {
    return this._get({
      path: ['instances', instanceId, 'sessions', sessionId, 'messages'],

      query: query
        ? mapDashboardInstanceSessionsMessagesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsMessagesListOutput);
  }

  /**
   * @name Get session message
   * @description Get the information of a specific session message
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `sessionMessageId` - string
   *
   * @returns DashboardInstanceSessionsMessagesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, sessionId: string, sessionMessageId: string) {
    return this._get({
      path: [
        'instances',
        instanceId,
        'sessions',
        sessionId,
        'messages',
        sessionMessageId
      ]
    }).transform(mapDashboardInstanceSessionsMessagesGetOutput);
  }
}
