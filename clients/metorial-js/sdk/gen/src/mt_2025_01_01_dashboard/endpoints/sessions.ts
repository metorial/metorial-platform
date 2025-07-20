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
export class MetorialSessionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List sessions
   * @description List all sessions
   *
   * @param `query` - DashboardInstanceSessionsListQuery
   *
   * @returns DashboardInstanceSessionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceSessionsListQuery) {
    return this._get({
      path: ['sessions'],

      query: query
        ? mapDashboardInstanceSessionsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsListOutput);
  }

  /**
   * @name Get session
   * @description Get the information of a specific session
   *
   * @param `sessionId` - string
   *
   * @returns DashboardInstanceSessionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(sessionId: string) {
    return this._get({
      path: ['sessions', sessionId]
    }).transform(mapDashboardInstanceSessionsGetOutput);
  }

  /**
   * @name Create session
   * @description Create a new session
   *
   * @param `body` - DashboardInstanceSessionsCreateBody
   *
   * @returns DashboardInstanceSessionsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(body: DashboardInstanceSessionsCreateBody) {
    return this._post({
      path: ['sessions'],
      body: mapDashboardInstanceSessionsCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceSessionsCreateOutput);
  }

  /**
   * @name Delete session
   * @description Delete a session
   *
   * @param `sessionId` - string
   *
   * @returns DashboardInstanceSessionsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(sessionId: string) {
    return this._delete({
      path: ['sessions', sessionId]
    }).transform(mapDashboardInstanceSessionsDeleteOutput);
  }
}
