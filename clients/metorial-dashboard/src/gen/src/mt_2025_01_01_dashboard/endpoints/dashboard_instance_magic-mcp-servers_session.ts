import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpServersSessionCreateOutput,
  type DashboardInstanceMagicMcpServersSessionCreateOutput
} from '../resources';

/**
 * @name Magic MCP Servers - Dashboard controller
 * @description Endpoints for magic MCP server management within the provider dashboard.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceMagicMcpServersSessionEndpoint {
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
   * @name Create linked magic MCP server session
   * @description Resolves the current internal ephemeral managed session for a magic MCP server and returns it as a dashboard session.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersSessionCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    magicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersSessionCreateOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/session`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpServersSessionCreateOutput
    );
  }
}
