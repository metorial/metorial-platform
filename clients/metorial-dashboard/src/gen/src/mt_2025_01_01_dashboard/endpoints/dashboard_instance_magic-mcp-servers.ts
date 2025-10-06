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
  mapDashboardInstanceMagicMcpServersUpdateBody,
  mapDashboardInstanceMagicMcpServersUpdateOutput,
  type DashboardInstanceMagicMcpServersCreateBody,
  type DashboardInstanceMagicMcpServersCreateOutput,
  type DashboardInstanceMagicMcpServersDeleteOutput,
  type DashboardInstanceMagicMcpServersGetOutput,
  type DashboardInstanceMagicMcpServersListOutput,
  type DashboardInstanceMagicMcpServersListQuery,
  type DashboardInstanceMagicMcpServersUpdateBody,
  type DashboardInstanceMagicMcpServersUpdateOutput
} from '../resources';

/**
 * @name Magic MCP Server controller
 * @description Before you can connect to an MCP server, you need to create a magic MCP server.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceMagicMcpServersEndpoint {
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
   * @name List magic MCP server
   * @description List all magic MCP server
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceMagicMcpServersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceMagicMcpServersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersListOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-servers`;

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
   * @description Get the information of a specific magic MCP server
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    magicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersGetOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersGetOutput
    );
  }

  /**
   * @name Create magic MCP server
   * @description Create a new magic MCP server
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceMagicMcpServersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceMagicMcpServersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersCreateOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-servers`;

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
   * @description Delete a specific magic MCP server
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    magicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}`;

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
   * @description Update the information of a specific magic MCP server
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `body` - DashboardInstanceMagicMcpServersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    magicMcpServerId: string,
    body: DashboardInstanceMagicMcpServersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}`;

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
