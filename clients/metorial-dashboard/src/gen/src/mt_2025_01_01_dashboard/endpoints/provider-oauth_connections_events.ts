import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthConnectionsEventsGetOutput,
  mapDashboardInstanceProviderOauthConnectionsEventsListOutput,
  mapDashboardInstanceProviderOauthConnectionsEventsListQuery,
  type DashboardInstanceProviderOauthConnectionsEventsGetOutput,
  type DashboardInstanceProviderOauthConnectionsEventsListOutput,
  type DashboardInstanceProviderOauthConnectionsEventsListQuery
} from '../resources';

/**
 * @name OAuth Event controller
 * @description Manage provider OAuth connection event information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderOauthConnectionsEventsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List provider OAuth connection events
   * @description List provider OAuth connection events for a specific connection
   *
   * @param `connectionId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsEventsListQuery
   *
   * @returns DashboardInstanceProviderOauthConnectionsEventsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    connectionId: string,
    query?: DashboardInstanceProviderOauthConnectionsEventsListQuery
  ): Promise<DashboardInstanceProviderOauthConnectionsEventsListOutput> {
    let path = `provider-oauth/connections/${connectionId}/events`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsEventsListQuery.transformTo(
            query
          )
        : undefined
    }).transform(mapDashboardInstanceProviderOauthConnectionsEventsListOutput);
  }

  /**
   * @name Get provider OAuth connection event
   * @description Get the information of a specific provider OAuth connection event
   *
   * @param `connectionId` - string
   * @param `eventId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsEventsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    connectionId: string,
    eventId: string
  ): Promise<DashboardInstanceProviderOauthConnectionsEventsGetOutput> {
    let path = `provider-oauth/connections/${connectionId}/events/${eventId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceProviderOauthConnectionsEventsGetOutput);
  }
}
