import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePublicMcpServersClientsListOutput,
  mapDashboardInstancePublicMcpServersClientsListQuery,
  type DashboardInstancePublicMcpServersClientsListOutput,
  type DashboardInstancePublicMcpServersClientsListQuery
} from '../resources';

/**
 * @name Public MCP Servers controller
 * @description A public MCP server exposes a provider deployment at a public URL. Any MCP client can connect, and each end user brings their own credentials through OAuth.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePublicMcpServersClientsEndpoint {
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
   * @name List public MCP server clients
   * @description Returns the OAuth clients registered with a public MCP server.
   *
   * @param `instanceId` - string
   * @param `publicMcpServerId` - string
   * @param `query` - DashboardInstancePublicMcpServersClientsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersClientsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    publicMcpServerId: string,
    query?: DashboardInstancePublicMcpServersClientsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersClientsListOutput> {
    let path = `instances/${instanceId}/public-mcp-servers/${publicMcpServerId}/clients`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePublicMcpServersClientsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePublicMcpServersClientsListOutput
    );
  }
}
