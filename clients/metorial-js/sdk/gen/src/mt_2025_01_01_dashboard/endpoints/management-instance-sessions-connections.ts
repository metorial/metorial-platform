import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsConnectionsGetOutput,
  mapDashboardInstanceSessionsConnectionsListOutput,
  mapDashboardInstanceSessionsConnectionsListQuery,
  type DashboardInstanceSessionsConnectionsGetOutput,
  type DashboardInstanceSessionsConnectionsListOutput,
  type DashboardInstanceSessionsConnectionsListQuery
} from '../resources';

/**
 * @name Session Connection controller
 * @description Each time a new MCP connection to a server is established, a session connection is created. This allows you to track and manage the connections made during a session.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionsConnectionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List session connections
   * @description List all session connections
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsConnectionsListQuery
   *
   * @returns DashboardInstanceSessionsConnectionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    query?: DashboardInstanceSessionsConnectionsListQuery
  ) {
    return this._get({
      path: ['instances', instanceId, 'sessions', sessionId, 'connections'],

      query: query
        ? mapDashboardInstanceSessionsConnectionsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsConnectionsListOutput);
  }

  /**
   * @name Get session connection
   * @description Get the information of a specific session connection
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `sessionConnectionId` - string
   *
   * @returns DashboardInstanceSessionsConnectionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, sessionId: string, sessionConnectionId: string) {
    return this._get({
      path: [
        'instances',
        instanceId,
        'sessions',
        sessionId,
        'connections',
        sessionConnectionId
      ]
    }).transform(mapDashboardInstanceSessionsConnectionsGetOutput);
  }
}
