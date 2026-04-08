import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpServersCreateBody,
  mapDashboardInstanceMagicMcpServersCreateOutput,
  mapDashboardInstanceMagicMcpServersDeleteOutput,
  mapDashboardInstanceMagicMcpServersGetOutput,
  mapDashboardInstanceMagicMcpServersListOutput,
  mapDashboardInstanceMagicMcpServersListQuery,
  mapDashboardInstanceMagicMcpServersToolsOutput,
  mapDashboardInstanceMagicMcpServersUpdateBody,
  mapDashboardInstanceMagicMcpServersUpdateOutput,
  type DashboardInstanceMagicMcpServersCreateBody,
  type DashboardInstanceMagicMcpServersCreateOutput,
  type DashboardInstanceMagicMcpServersDeleteOutput,
  type DashboardInstanceMagicMcpServersGetOutput,
  type DashboardInstanceMagicMcpServersListOutput,
  type DashboardInstanceMagicMcpServersListQuery,
  type DashboardInstanceMagicMcpServersToolsOutput,
  type DashboardInstanceMagicMcpServersUpdateBody,
  type DashboardInstanceMagicMcpServersUpdateOutput
} from '../resources';

/**
 * @name Magic MCP Servers controller
 * @description Magic MCP servers are stable MCP entrypoints backed by one Subspace session template.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialMagicMcpServersEndpoint {
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
   * @name List magic MCP servers
   * @description Returns a paginated list of magic MCP servers.
   *
   * @param `query` - DashboardInstanceMagicMcpServersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceMagicMcpServersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersListOutput> {
    let path = 'magic-mcp-servers';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMagicMcpServersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersListOutput
    );
  }

  /**
   * @name Get magic MCP server
   * @description Retrieves a specific magic MCP server.
   *
   * @param `magicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    magicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersGetOutput> {
    let path = `magic-mcp-servers/${magicMcpServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersGetOutput
    );
  }

  /**
   * @name List magic MCP server tools
   * @description Returns the effective set of tools available through the providers backing a magic MCP server.
   *
   * @param `magicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersToolsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  tools(
    magicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersToolsOutput> {
    let path = `magic-mcp-servers/${magicMcpServerId}/tools`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersToolsOutput
    );
  }

  /**
   * @name Create magic MCP server
   * @description Creates a magic MCP server with a new session template. A Subspace session is created automatically on first connection and then reused.
   *
   * @param `body` - DashboardInstanceMagicMcpServersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceMagicMcpServersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersCreateOutput> {
    let path = 'magic-mcp-servers';

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpServersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpServersCreateOutput
    );
  }

  /**
   * @name Delete magic MCP server
   * @description Archives a magic MCP server.
   *
   * @param `magicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    magicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersDeleteOutput> {
    let path = `magic-mcp-servers/${magicMcpServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceMagicMcpServersDeleteOutput
    );
  }

  /**
   * @name Update magic MCP server
   * @description Updates a magic MCP server.
   *
   * @param `magicMcpServerId` - string
   * @param `body` - DashboardInstanceMagicMcpServersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    magicMcpServerId: string,
    body: DashboardInstanceMagicMcpServersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersUpdateOutput> {
    let path = `magic-mcp-servers/${magicMcpServerId}`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpServersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceMagicMcpServersUpdateOutput
    );
  }
}
