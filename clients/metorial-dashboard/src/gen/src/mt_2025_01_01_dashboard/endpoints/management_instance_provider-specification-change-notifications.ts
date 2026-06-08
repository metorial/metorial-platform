import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderSpecificationChangeNotificationsGetOutput,
  mapDashboardInstanceProviderSpecificationChangeNotificationsListOutput,
  mapDashboardInstanceProviderSpecificationChangeNotificationsListQuery,
  type DashboardInstanceProviderSpecificationChangeNotificationsGetOutput,
  type DashboardInstanceProviderSpecificationChangeNotificationsListOutput,
  type DashboardInstanceProviderSpecificationChangeNotificationsListQuery
} from '../resources';

/**
 * @name Provider Specification Change Notifications controller
 * @description Provider specification change notifications describe provider schema changes.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderSpecificationChangeNotificationsEndpoint {
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
   * @name List provider specification change notifications
   * @description Returns a paginated list of provider specification change notifications for this instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderSpecificationChangeNotificationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderSpecificationChangeNotificationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderSpecificationChangeNotificationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderSpecificationChangeNotificationsListOutput> {
    let path = `instances/${instanceId}/provider-specification-change-notifications`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderSpecificationChangeNotificationsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderSpecificationChangeNotificationsListOutput
    );
  }

  /**
   * @name Get provider specification change notification
   * @description Retrieves a provider specification change notification by ID.
   *
   * @param `instanceId` - string
   * @param `notificationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderSpecificationChangeNotificationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    notificationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderSpecificationChangeNotificationsGetOutput> {
    let path = `instances/${instanceId}/provider-specification-change-notifications/${notificationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderSpecificationChangeNotificationsGetOutput
    );
  }
}
