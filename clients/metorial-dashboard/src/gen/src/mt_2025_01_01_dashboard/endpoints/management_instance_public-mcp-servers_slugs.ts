import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstancePublicMcpServersSlugsCheckOutput,
  mapDashboardInstancePublicMcpServersSlugsCheckQuery,
  type DashboardInstancePublicMcpServersSlugsCheckOutput,
  type DashboardInstancePublicMcpServersSlugsCheckQuery
} from '../resources';

/**
 * @name Public MCP Servers controller
 * @description A public MCP server exposes a provider deployment at a public URL. Any MCP client can connect, and each end user brings their own credentials through OAuth.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstancePublicMcpServersSlugsEndpoint {
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
   * @name Check public MCP server slug
   * @description Checks whether a slug can be claimed for a new public MCP server.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstancePublicMcpServersSlugsCheckQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstancePublicMcpServersSlugsCheckOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  check(
    instanceId: string,
    query?: DashboardInstancePublicMcpServersSlugsCheckQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstancePublicMcpServersSlugsCheckOutput> {
    let path = `instances/${instanceId}/public-mcp-server-slugs/availability`;

    let request = {
      path,

      query: query
        ? mapDashboardInstancePublicMcpServersSlugsCheckQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstancePublicMcpServersSlugsCheckOutput
    );
  }
}
