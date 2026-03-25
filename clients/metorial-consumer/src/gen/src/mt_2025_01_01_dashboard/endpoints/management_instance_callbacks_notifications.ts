import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksNotificationsGetOutput,
  mapDashboardInstanceCallbacksNotificationsListOutput,
  mapDashboardInstanceCallbacksNotificationsListQuery,
  type DashboardInstanceCallbacksNotificationsGetOutput,
  type DashboardInstanceCallbacksNotificationsListOutput,
  type DashboardInstanceCallbacksNotificationsListQuery
} from '../resources';

/**
 * @name Callback Notifications controller
 * @description Read callback notification deliveries.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceCallbacksNotificationsEndpoint {
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
   * @name List callback notifications
   * @description Returns a paginated list of callback notifications.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `query` - DashboardInstanceCallbacksNotificationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksNotificationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    callbackId: string,
    query?: DashboardInstanceCallbacksNotificationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksNotificationsListOutput> {
    let path = `instances/${instanceId}/callbacks/${callbackId}/notifications`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbacksNotificationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksNotificationsListOutput
    );
  }

  /**
   * @name Get callback notification
   * @description Retrieves a specific callback notification.
   *
   * @param `instanceId` - string
   * @param `callbackId` - string
   * @param `callbackNotificationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksNotificationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    callbackId: string,
    callbackNotificationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksNotificationsGetOutput> {
    let path = `instances/${instanceId}/callbacks/${callbackId}/notifications/${callbackNotificationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksNotificationsGetOutput
    );
  }
}
