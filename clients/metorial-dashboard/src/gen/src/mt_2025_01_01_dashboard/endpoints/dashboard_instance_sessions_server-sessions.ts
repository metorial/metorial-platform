import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsServerSessionsGetOutput,
  mapDashboardInstanceSessionsServerSessionsListOutput,
  mapDashboardInstanceSessionsServerSessionsListQuery,
  type DashboardInstanceSessionsServerSessionsGetOutput,
  type DashboardInstanceSessionsServerSessionsListOutput,
  type DashboardInstanceSessionsServerSessionsListQuery
} from '../resources';

/**
 * @name Server Session controller
 * @description Read and write server session information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSessionsServerSessionsEndpoint {
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
   * @name List server sessions
   * @description List all server sessions
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsServerSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsServerSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    query?: DashboardInstanceSessionsServerSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsServerSessionsListOutput> {
    let path = `dashboard/instances/${instanceId}/sessions/${sessionId}/server-sessions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsServerSessionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsServerSessionsListOutput
    );
  }

  /**
   * @name Get server session
   * @description Get the information of a specific server session
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `serverSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsServerSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionId: string,
    serverSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsServerSessionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/sessions/${sessionId}/server-sessions/${serverSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsServerSessionsGetOutput
    );
  }
}
