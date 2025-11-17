import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersRemoteServersGetOutput,
  mapDashboardInstanceCustomServersRemoteServersListOutput,
  mapDashboardInstanceCustomServersRemoteServersListQuery,
  type DashboardInstanceCustomServersRemoteServersGetOutput,
  type DashboardInstanceCustomServersRemoteServersListOutput,
  type DashboardInstanceCustomServersRemoteServersListQuery
} from '../resources';

/**
 * @name Remote Server controller
 * @description Manager remote servers
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomServersRemoteServersEndpoint {
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
   * @name List remote servers
   * @description List all remote servers
   *
   * @param `query` - DashboardInstanceCustomServersRemoteServersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersRemoteServersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceCustomServersRemoteServersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersRemoteServersListOutput> {
    let path = 'custom-servers/remote-servers';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomServersRemoteServersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersRemoteServersListOutput
    );
  }

  /**
   * @name Get remote server
   * @description Get information for a specific remote server
   *
   * @param `remoteServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersRemoteServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    remoteServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersRemoteServersGetOutput> {
    let path = `custom-servers/remote-servers/${remoteServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersRemoteServersGetOutput
    );
  }
}
