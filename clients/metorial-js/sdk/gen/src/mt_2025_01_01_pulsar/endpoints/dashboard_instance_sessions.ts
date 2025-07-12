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
export class MetorialDashboardInstanceSessionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server deployments
   * @description List all server deployments
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSessionsListQuery
   *
   * @returns DashboardInstanceSessionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSessionsListQuery
  ): Promise<DashboardInstanceSessionsListOutput> {
    let path = `dashboard/instances/${instanceId}/sessions`;
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
   * @param `instanceId` - string
   * @param `sessionId` - string
   *
   * @returns DashboardInstanceSessionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionId: string
  ): Promise<DashboardInstanceSessionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/sessions/${sessionId}`;
    return this._get({
      path
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
  create(
    instanceId: string,
    body: DashboardInstanceSessionsCreateBody
  ): Promise<DashboardInstanceSessionsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/sessions`;
    return this._post({
      path,
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
  delete(
    instanceId: string,
    sessionId: string
  ): Promise<DashboardInstanceSessionsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/sessions/${sessionId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceSessionsDeleteOutput);
  }
}
