import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersRemoteServersNotificationsGetOutput,
  mapDashboardInstanceCustomServersRemoteServersNotificationsListOutput,
  mapDashboardInstanceCustomServersRemoteServersNotificationsListQuery,
  type DashboardInstanceCustomServersRemoteServersNotificationsGetOutput,
  type DashboardInstanceCustomServersRemoteServersNotificationsListOutput,
  type DashboardInstanceCustomServersRemoteServersNotificationsListQuery
} from '../resources';

/**
 * @name Remote Server Notification controller
 * @description Manager remote server notifications
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomServersRemoteServersNotificationsEndpoint {
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
   * @name List remote server notifications
   * @description List all remote server notifications
   *
   * @param `remoteServerId` - string
   * @param `query` - DashboardInstanceCustomServersRemoteServersNotificationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersRemoteServersNotificationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    remoteServerId: string,
    query?: DashboardInstanceCustomServersRemoteServersNotificationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersRemoteServersNotificationsListOutput> {
    let path = `custom-servers/remote-servers/${remoteServerId}/notifications`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomServersRemoteServersNotificationsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersRemoteServersNotificationsListOutput
    );
  }

  /**
   * @name Get remote server notification
   * @description Get information for a specific remote server notification
   *
   * @param `remoteServerId` - string
   * @param `remoteServerNotificationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersRemoteServersNotificationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    remoteServerId: string,
    remoteServerNotificationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersRemoteServersNotificationsGetOutput> {
    let path = `custom-servers/remote-servers/${remoteServerId}/notifications/${remoteServerNotificationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersRemoteServersNotificationsGetOutput
    );
  }
}
