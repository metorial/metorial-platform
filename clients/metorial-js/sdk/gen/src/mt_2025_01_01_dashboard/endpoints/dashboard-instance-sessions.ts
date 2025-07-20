import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsCreateBody,
  mapDashboardInstanceSessionsCreateOutput,
  mapDashboardInstanceSessionsDeleteOutput,
  mapDashboardInstanceSessionsGetOutput,
  mapDashboardInstanceSessionsListOutput,
  mapDashboardInstanceSessionsListQuery,
  type DashboardInstanceSessionsCreateBody,
  type DashboardInstanceSessionsCreateOutput,
  type DashboardInstanceSessionsDeleteOutput,
  type DashboardInstanceSessionsGetOutput,
  type DashboardInstanceSessionsListOutput,
  type DashboardInstanceSessionsListQuery
} from '../resources';

/**
 * @name Session controller
 * @description Before you can connect to an MCP server, you need to create a session. Each session can be linked to one or more server deployments, allowing you to connect to multiple servers simultaneously. Once you have created a session, you can use the provided MCP URL to connect to the server deployments via MCP.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSessionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List sessions
   * @description List all sessions
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSessionsListQuery
   *
   * @returns DashboardInstanceSessionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, query?: DashboardInstanceSessionsListQuery) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'sessions'],

      query: query
        ? mapDashboardInstanceSessionsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsListOutput);
  }

  /**
   * @name Get session
   * @description Get the information of a specific session
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   *
   * @returns DashboardInstanceSessionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, sessionId: string) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'sessions', sessionId]
    }).transform(mapDashboardInstanceSessionsGetOutput);
  }

  /**
   * @name Create session
   * @description Create a new session
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSessionsCreateBody
   *
   * @returns DashboardInstanceSessionsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(instanceId: string, body: DashboardInstanceSessionsCreateBody) {
    return this._post({
      path: ['dashboard', 'instances', instanceId, 'sessions'],
      body: mapDashboardInstanceSessionsCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceSessionsCreateOutput);
  }

  /**
   * @name Delete session
   * @description Delete a session
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   *
   * @returns DashboardInstanceSessionsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(instanceId: string, sessionId: string) {
    return this._delete({
      path: ['dashboard', 'instances', instanceId, 'sessions', sessionId]
    }).transform(mapDashboardInstanceSessionsDeleteOutput);
  }
}
