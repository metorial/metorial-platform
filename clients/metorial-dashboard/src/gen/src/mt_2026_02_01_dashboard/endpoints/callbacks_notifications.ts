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
 * @description Represents callbacks that you have uploaded to Metorial. Callbacks can be linked to various resources based on their purpose. Metorial can also automatically extract callbacks for you, for example for data exports.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCallbacksNotificationsEndpoint {
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
   * @description Returns a paginated list of callback notifications for a specific callback.
   *
   * @param `query` - DashboardInstanceCallbacksNotificationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksNotificationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceCallbacksNotificationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksNotificationsListOutput> {
    let path = 'callbacks-notifications';

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
   * @name Get callback notification by ID
   * @description Retrieves details for a specific callback by its ID.
   *
   * @param `notificationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksNotificationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    notificationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksNotificationsGetOutput> {
    let path = `callbacks-notifications/${notificationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksNotificationsGetOutput
    );
  }
}
