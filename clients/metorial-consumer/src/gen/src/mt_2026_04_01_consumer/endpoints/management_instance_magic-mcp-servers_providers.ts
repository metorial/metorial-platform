import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpServersProvidersCreateBody,
  mapDashboardInstanceMagicMcpServersProvidersCreateOutput,
  mapDashboardInstanceMagicMcpServersProvidersDeleteOutput,
  mapDashboardInstanceMagicMcpServersProvidersGetOutput,
  mapDashboardInstanceMagicMcpServersProvidersListOutput,
  mapDashboardInstanceMagicMcpServersProvidersListQuery,
  mapDashboardInstanceMagicMcpServersProvidersUpdateBody,
  mapDashboardInstanceMagicMcpServersProvidersUpdateOutput,
  type DashboardInstanceMagicMcpServersProvidersCreateBody,
  type DashboardInstanceMagicMcpServersProvidersCreateOutput,
  type DashboardInstanceMagicMcpServersProvidersDeleteOutput,
  type DashboardInstanceMagicMcpServersProvidersGetOutput,
  type DashboardInstanceMagicMcpServersProvidersListOutput,
  type DashboardInstanceMagicMcpServersProvidersListQuery,
  type DashboardInstanceMagicMcpServersProvidersUpdateBody,
  type DashboardInstanceMagicMcpServersProvidersUpdateOutput
} from '../resources';

/**
 * @name Magic MCP Server Providers controller
 * @description Magic MCP server providers define which providers are included in the setup session template backing a magic MCP server.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceMagicMcpServersProvidersEndpoint {
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
   * @name List magic MCP server providers
   * @description Returns a paginated list of providers configured for a magic MCP server.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `query` - DashboardInstanceMagicMcpServersProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    magicMcpServerId: string,
    query?: DashboardInstanceMagicMcpServersProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProvidersListOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMagicMcpServersProvidersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersProvidersListOutput
    );
  }

  /**
   * @name Get magic MCP server provider
   * @description Retrieves a specific provider configuration from a magic MCP server.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `magicMcpServerProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    magicMcpServerId: string,
    magicMcpServerProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProvidersGetOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/providers/${magicMcpServerProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersProvidersGetOutput
    );
  }

  /**
   * @name Create magic MCP server provider
   * @description Adds a new provider configuration to a magic MCP server.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `body` - DashboardInstanceMagicMcpServersProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    magicMcpServerId: string,
    body: DashboardInstanceMagicMcpServersProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProvidersCreateOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/providers`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpServersProvidersCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpServersProvidersCreateOutput
    );
  }

  /**
   * @name Update magic MCP server provider
   * @description Updates a provider configuration in a magic MCP server.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `magicMcpServerProviderId` - string
   * @param `body` - DashboardInstanceMagicMcpServersProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    magicMcpServerId: string,
    magicMcpServerProviderId: string,
    body: DashboardInstanceMagicMcpServersProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProvidersUpdateOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/providers/${magicMcpServerProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpServersProvidersUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceMagicMcpServersProvidersUpdateOutput
    );
  }

  /**
   * @name Delete magic MCP server provider
   * @description Removes a provider configuration from a magic MCP server.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `magicMcpServerProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProvidersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    magicMcpServerId: string,
    magicMcpServerProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProvidersDeleteOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/providers/${magicMcpServerProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceMagicMcpServersProvidersDeleteOutput
    );
  }
}
