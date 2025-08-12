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
export class MetorialManagementInstanceProviderOauthConnectionsEventsEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name List provider OAuth connection events
   * @description List provider OAuth connection events for a specific connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    connectionId: string,
    query?: DashboardInstanceProviderOauthConnectionsEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsEventsListOutput> {
    let path = `instances/${instanceId}/provider-oauth/connections/${connectionId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsEventsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsEventsListOutput
    );
  }

  /**
   * @name Get provider OAuth connection event
   * @description Get the information of a specific provider OAuth connection event
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `eventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    connectionId: string,
    eventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsEventsGetOutput> {
    let path = `instances/${instanceId}/provider-oauth/connections/${connectionId}/events/${eventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsEventsGetOutput
    );
  }
}
