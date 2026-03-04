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
 * @name Magic MCP Sessions controller
 * @description Magic MCP sessions map a Magic MCP server to one Subspace session and are created on demand by the MCP connection API.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialMagicMcpSessionsEndpoint {
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
   * @name List magic MCP sessions
   * @description Returns a paginated list of magic MCP sessions.
   *
   * @param `query` - DashboardInstanceMagicMcpSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceMagicMcpSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpSessionsListOutput> {
    let path = 'magic-mcp-sessions';

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
   * @description Retrieves a specific magic MCP session.
   *
   * @param `magicMcpSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    magicMcpSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpSessionsGetOutput> {
    let path = `magic-mcp-sessions/${magicMcpSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpSessionsGetOutput
    );
  }
}
