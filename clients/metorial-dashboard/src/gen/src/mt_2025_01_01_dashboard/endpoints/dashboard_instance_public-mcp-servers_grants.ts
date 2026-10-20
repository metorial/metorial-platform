import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePublicMcpServersGrantsGetOutput,
  mapDashboardInstancePublicMcpServersGrantsListOutput,
  mapDashboardInstancePublicMcpServersGrantsListQuery,
  mapDashboardInstancePublicMcpServersGrantsRevokeOutput,
  type DashboardInstancePublicMcpServersGrantsGetOutput,
  type DashboardInstancePublicMcpServersGrantsListOutput,
  type DashboardInstancePublicMcpServersGrantsListQuery,
  type DashboardInstancePublicMcpServersGrantsRevokeOutput
} from '../resources';

/**
 * @name Public MCP Servers controller
 * @description A public MCP server exposes a provider deployment at a public URL. Any MCP client can connect, and each end user brings their own credentials through OAuth.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstancePublicMcpServersGrantsEndpoint {
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
   * @name List public MCP server grants
   * @description Returns the end-user grants of a public MCP server.
   *
   * @param `instanceId` - string
   * @param `publicMcpServerId` - string
   * @param `query` - DashboardInstancePublicMcpServersGrantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersGrantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    publicMcpServerId: string,
    query?: DashboardInstancePublicMcpServersGrantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersGrantsListOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers/${publicMcpServerId}/grants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePublicMcpServersGrantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePublicMcpServersGrantsListOutput
    );
  }

  /**
   * @name Get public MCP server grant
   * @description Retrieves a specific end-user grant.
   *
   * @param `instanceId` - string
   * @param `publicMcpServerId` - string
   * @param `publicMcpServerGrantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersGrantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    publicMcpServerId: string,
    publicMcpServerGrantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersGrantsGetOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers/${publicMcpServerId}/grants/${publicMcpServerGrantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePublicMcpServersGrantsGetOutput
    );
  }

  /**
   * @name Revoke public MCP server grant
   * @description Revokes an end-user grant. Its tokens stop working and the user's credentials are deleted.
   *
   * @param `instanceId` - string
   * @param `publicMcpServerId` - string
   * @param `publicMcpServerGrantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersGrantsRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    instanceId: string,
    publicMcpServerId: string,
    publicMcpServerGrantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersGrantsRevokeOutput> {
    let path = `dashboard/instances/${instanceId}/public-mcp-servers/${publicMcpServerId}/grants/${publicMcpServerGrantId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstancePublicMcpServersGrantsRevokeOutput
    );
  }
}
