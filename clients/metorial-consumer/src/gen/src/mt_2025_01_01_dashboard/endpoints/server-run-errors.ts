import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServerRunErrorsGetOutput,
  mapDashboardInstanceServerRunErrorsListOutput,
  mapDashboardInstanceServerRunErrorsListQuery,
  type DashboardInstanceServerRunErrorsGetOutput,
  type DashboardInstanceServerRunErrorsListOutput,
  type DashboardInstanceServerRunErrorsListQuery
} from '../resources';

/**
 * @name Server Run Error controller
 * @description Sometimes, an MCP server may fail to run correctly, resulting in an error. Metorial captures these errors to help you diagnose issues with your server runs. You may also want to check the Metorial dashboard for more details on the error.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServerRunErrorsEndpoint {
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
   * @name List server run errors
   * @description List all server run errors
   *
   * @param `query` - DashboardInstanceServerRunErrorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerRunErrorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceServerRunErrorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerRunErrorsListOutput> {
    let path = 'server-run-errors';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServerRunErrorsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerRunErrorsListOutput
    );
  }

  /**
   * @name Get server run error
   * @description Get the information of a specific server run error
   *
   * @param `serverRunErrorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServerRunErrorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverRunErrorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServerRunErrorsGetOutput> {
    let path = `server-run-errors/${serverRunErrorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServerRunErrorsGetOutput
    );
  }
}
