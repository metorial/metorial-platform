import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersEventsGetOutput,
  mapDashboardInstanceCustomServersEventsListOutput,
  mapDashboardInstanceCustomServersEventsListQuery,
  type DashboardInstanceCustomServersEventsGetOutput,
  type DashboardInstanceCustomServersEventsListOutput,
  type DashboardInstanceCustomServersEventsListQuery
} from '../resources';

/**
 * @name Custom Server controller
 * @description Manager custom server events
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceCustomServersEventsEndpoint {
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
   * @name List custom server events
   * @description List all custom server events
   *
   * @param `instanceId` - string
   * @param `customServerId` - string
   * @param `query` - DashboardInstanceCustomServersEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    customServerId: string,
    query?: DashboardInstanceCustomServersEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersEventsListOutput> {
    let path = `instances/${instanceId}/custom-servers/${customServerId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomServersEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersEventsListOutput
    );
  }

  /**
   * @name Get custom server event
   * @description Get information for a specific custom server event
   *
   * @param `instanceId` - string
   * @param `customServerId` - string
   * @param `customServerEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    customServerId: string,
    customServerEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersEventsGetOutput> {
    let path = `instances/${instanceId}/custom-servers/${customServerId}/events/${customServerEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersEventsGetOutput
    );
  }
}
