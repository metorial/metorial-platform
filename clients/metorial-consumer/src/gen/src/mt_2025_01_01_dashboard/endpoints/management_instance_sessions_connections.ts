import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsConnectionsGetOutput,
  mapDashboardInstanceSessionsConnectionsListOutput,
  mapDashboardInstanceSessionsConnectionsListQuery,
  type DashboardInstanceSessionsConnectionsGetOutput,
  type DashboardInstanceSessionsConnectionsListOutput,
  type DashboardInstanceSessionsConnectionsListQuery
} from '../resources';

/**
 * @name Session Connections controller
 * @description Session connections represent the MCP connections established within a session. This read-only resource provides visibility into the connection state and capabilities.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionsConnectionsEndpoint {
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
   * @name List session connections
   * @description Returns a paginated list of connections for a session.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSessionsConnectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsConnectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSessionsConnectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsConnectionsListOutput> {
    let path = `instances/${instanceId}/session-connections`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsConnectionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsConnectionsListOutput
    );
  }

  /**
   * @name Get session connection
   * @description Retrieves a specific connection from a session.
   *
   * @param `instanceId` - string
   * @param `sessionConnectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsConnectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionConnectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsConnectionsGetOutput> {
    let path = `instances/${instanceId}/session-connections/${sessionConnectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsConnectionsGetOutput
    );
  }
}
