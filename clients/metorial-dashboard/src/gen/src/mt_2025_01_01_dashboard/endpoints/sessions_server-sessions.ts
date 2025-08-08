import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsServerSessionsGetOutput,
  mapDashboardInstanceSessionsServerSessionsListOutput,
  mapDashboardInstanceSessionsServerSessionsListQuery,
  type DashboardInstanceSessionsServerSessionsGetOutput,
  type DashboardInstanceSessionsServerSessionsListOutput,
  type DashboardInstanceSessionsServerSessionsListQuery
} from '../resources';

/**
 * @name Server Session controller
 * @description Read and write server session information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsServerSessionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server sessions
   * @description List all server sessions
   *
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsServerSessionsListQuery
   *
   * @returns DashboardInstanceSessionsServerSessionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    sessionId: string,
    query?: DashboardInstanceSessionsServerSessionsListQuery
  ): Promise<DashboardInstanceSessionsServerSessionsListOutput> {
    let path = `sessions/${sessionId}/server-sessions`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceSessionsServerSessionsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsServerSessionsListOutput);
  }

  /**
   * @name Get server session
   * @description Get the information of a specific server session
   *
   * @param `sessionId` - string
   * @param `serverSessionId` - string
   *
   * @returns DashboardInstanceSessionsServerSessionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    serverSessionId: string
  ): Promise<DashboardInstanceSessionsServerSessionsGetOutput> {
    let path = `sessions/${sessionId}/server-sessions/${serverSessionId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceSessionsServerSessionsGetOutput);
  }
}
