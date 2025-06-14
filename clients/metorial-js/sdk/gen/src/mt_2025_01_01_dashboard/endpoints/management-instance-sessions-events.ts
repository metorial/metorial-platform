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
export class MetorialManagementInstanceSessionsEventsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List session events
   * @description List all session events
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsEventsListQuery
   *
   * @returns DashboardInstanceSessionsEventsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    query?: DashboardInstanceSessionsEventsListQuery
  ) {
    return this._get({
      path: ['instances', instanceId, 'sessions', sessionId, 'events'],

      query: query
        ? mapDashboardInstanceSessionsEventsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceSessionsEventsListOutput);
  }

  /**
   * @name Get session event
   * @description Get the information of a specific session event
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `sessionEventId` - string
   *
   * @returns DashboardInstanceSessionsEventsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, sessionId: string, sessionEventId: string) {
    return this._get({
      path: [
        'instances',
        instanceId,
        'sessions',
        sessionId,
        'events',
        sessionEventId
      ]
    }).transform(mapDashboardInstanceSessionsEventsGetOutput);
  }
}
