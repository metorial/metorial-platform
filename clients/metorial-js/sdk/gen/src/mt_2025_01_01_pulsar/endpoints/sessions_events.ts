import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsEventsGetOutput,
  mapDashboardInstanceSessionsEventsListOutput,
  mapDashboardInstanceSessionsEventsListQuery,
  type DashboardInstanceSessionsEventsGetOutput,
  type DashboardInstanceSessionsEventsListOutput,
  type DashboardInstanceSessionsEventsListQuery
} from '../resources';

/**
 * @name Session Event controller
 * @description Read and write session event information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsEventsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List session events
   * @description List all session events
   *
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsEventsListQuery
   *
   * @returns DashboardInstanceSessionsEventsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    sessionId: string,
    query?: DashboardInstanceSessionsEventsListQuery
  ): Promise<DashboardInstanceSessionsEventsListOutput> {
    let path = `sessions/${sessionId}/events`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceSessionsEventsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsEventsListOutput);
  }

  /**
   * @name Get session event
   * @description Get the information of a specific session event
   *
   * @param `sessionId` - string
   * @param `sessionEventId` - string
   *
   * @returns DashboardInstanceSessionsEventsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    sessionEventId: string
  ): Promise<DashboardInstanceSessionsEventsGetOutput> {
    let path = `sessions/${sessionId}/events/${sessionEventId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceSessionsEventsGetOutput);
  }
}
