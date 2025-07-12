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
 * @name Server Instance controller
 * @description Read and write session information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server deployments
   * @description List all server deployments
   *
   * @param `query` - DashboardInstanceSessionsListQuery
   *
   * @returns DashboardInstanceSessionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSessionsListQuery
  ): Promise<DashboardInstanceSessionsListOutput> {
    let path = 'sessions';
    return this._get({
      path,

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
  get(sessionId: string): Promise<DashboardInstanceSessionsGetOutput> {
    let path = `sessions/${sessionId}`;
    return this._get({
      path
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
  create(
    body: DashboardInstanceSessionsCreateBody
  ): Promise<DashboardInstanceSessionsCreateOutput> {
    let path = 'sessions';
    return this._post({
      path,
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
  delete(sessionId: string): Promise<DashboardInstanceSessionsDeleteOutput> {
    let path = `sessions/${sessionId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceSessionsDeleteOutput);
  }
}
