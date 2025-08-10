import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServerRunsGetOutput,
  mapDashboardInstanceServerRunsListOutput,
  mapDashboardInstanceServerRunsListQuery,
  type DashboardInstanceServerRunsGetOutput,
  type DashboardInstanceServerRunsListOutput,
  type DashboardInstanceServerRunsListQuery
} from '../resources';

/**
 * @name Server Run controller
 * @description Each time an MCP server is executed by the Metorial platform, a server run is created. This allows you to track the execution of MCP servers, including their status and associated sessions. Metorial may create multiple server runs for a single session or session connection.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServerRunsEndpoint {
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
   * @name List server runs
   * @description List all server runs
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServerRunsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerRunsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServerRunsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerRunsListOutput> {
    let path = `dashboard/instances/${instanceId}/server-runs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServerRunsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerRunsListOutput
    );
  }

  /**
   * @name Get server run
   * @description Get the information of a specific server run
   *
   * @param `instanceId` - string
   * @param `serverRunId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerRunsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverRunId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerRunsGetOutput> {
    let path = `dashboard/instances/${instanceId}/server-runs/${serverRunId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerRunsGetOutput
    );
  }
}
