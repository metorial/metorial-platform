import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePublicMcpServersCreateBody,
  mapDashboardInstancePublicMcpServersCreateOutput,
  mapDashboardInstancePublicMcpServersDeleteOutput,
  mapDashboardInstancePublicMcpServersGetOutput,
  mapDashboardInstancePublicMcpServersListOutput,
  mapDashboardInstancePublicMcpServersListQuery,
  mapDashboardInstancePublicMcpServersUpdateBody,
  mapDashboardInstancePublicMcpServersUpdateOutput,
  type DashboardInstancePublicMcpServersCreateBody,
  type DashboardInstancePublicMcpServersCreateOutput,
  type DashboardInstancePublicMcpServersDeleteOutput,
  type DashboardInstancePublicMcpServersGetOutput,
  type DashboardInstancePublicMcpServersListOutput,
  type DashboardInstancePublicMcpServersListQuery,
  type DashboardInstancePublicMcpServersUpdateBody,
  type DashboardInstancePublicMcpServersUpdateOutput
} from '../resources';

/**
 * @name Public MCP Servers controller
 * @description A public MCP server exposes a provider deployment at a public URL. Any MCP client can connect, and each end user brings their own credentials through OAuth.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePublicMcpServersEndpoint {
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
   * @name List public MCP servers
   * @description Returns a paginated list of public MCP servers.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstancePublicMcpServersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstancePublicMcpServersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersListOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePublicMcpServersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePublicMcpServersListOutput
    );
  }

  /**
   * @name Get public MCP server
   * @description Retrieves a specific public MCP server by ID.
   *
   * @param `instanceId` - string
   * @param `publicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    publicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersGetOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers/${publicMcpServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePublicMcpServersGetOutput
    );
  }

  /**
   * @name Create public MCP server
   * @description Creates a public MCP server for a provider deployment.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstancePublicMcpServersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstancePublicMcpServersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersCreateOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers`;

    let request = {
      path,
      body: mapDashboardInstancePublicMcpServersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePublicMcpServersCreateOutput
    );
  }

  /**
   * @name Update public MCP server
   * @description Updates a public MCP server. Set status to disabled to stop accepting connections.
   *
   * @param `instanceId` - string
   * @param `publicMcpServerId` - string
   * @param `body` - DashboardInstancePublicMcpServersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    publicMcpServerId: string,
    body: DashboardInstancePublicMcpServersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers/${publicMcpServerId}`;

    let request = {
      path,
      body: mapDashboardInstancePublicMcpServersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstancePublicMcpServersUpdateOutput
    );
  }

  /**
   * @name Delete public MCP server
   * @description Archives a public MCP server, revokes every grant, and releases its slug.
   *
   * @param `instanceId` - string
   * @param `publicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    publicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers/${publicMcpServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstancePublicMcpServersDeleteOutput
    );
  }
}
