import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServerRunErrorGroupsGetOutput,
  mapDashboardInstanceServerRunErrorGroupsListOutput,
  mapDashboardInstanceServerRunErrorGroupsListQuery,
  type DashboardInstanceServerRunErrorGroupsGetOutput,
  type DashboardInstanceServerRunErrorGroupsListOutput,
  type DashboardInstanceServerRunErrorGroupsListQuery
} from '../resources';

/**
 * @name Server Run Error Group controller
 * @description Read and write server run error group information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServerRunErrorGroupsEndpoint {
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
   * @name List server run error groups
   * @description List all server run error groups
   *
   * @param `query` - DashboardInstanceServerRunErrorGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerRunErrorGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceServerRunErrorGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerRunErrorGroupsListOutput> {
    let path = 'server-run-error-groups';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServerRunErrorGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerRunErrorGroupsListOutput
    );
  }

  /**
   * @name Get server run error group
   * @description Get the information of a specific server run error group
   *
   * @param `serverRunErrorGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerRunErrorGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverRunErrorGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerRunErrorGroupsGetOutput> {
    let path = `server-run-error-groups/${serverRunErrorGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerRunErrorGroupsGetOutput
    );
  }
}
