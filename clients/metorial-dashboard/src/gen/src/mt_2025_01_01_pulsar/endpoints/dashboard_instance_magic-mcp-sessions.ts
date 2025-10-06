import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpSessionsGetOutput,
  mapDashboardInstanceMagicMcpSessionsListOutput,
  mapDashboardInstanceMagicMcpSessionsListQuery,
  type DashboardInstanceMagicMcpSessionsGetOutput,
  type DashboardInstanceMagicMcpSessionsListOutput,
  type DashboardInstanceMagicMcpSessionsListQuery
} from '../resources';

/**
 * @name Magic MCP Session controller
 * @description Magic MCP sessions are created when a user connects to a magic MCP session using a valid magic MCP token.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceMagicMcpSessionsEndpoint {
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
   * @name List magic MCP session
   * @description List all magic MCP session
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceMagicMcpSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceMagicMcpSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpSessionsListOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-sessions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMagicMcpSessionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpSessionsListOutput
    );
  }

  /**
   * @name Get magic MCP session
   * @description Get the information of a specific magic MCP session
   *
   * @param `instanceId` - string
   * @param `magicMcpSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    magicMcpSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpSessionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-sessions/${magicMcpSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpSessionsGetOutput
    );
  }
}
