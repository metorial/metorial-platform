import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpServersProviderCreateBody,
  mapDashboardInstanceMagicMcpServersProviderCreateOutput,
  mapDashboardInstanceMagicMcpServersProviderDeleteOutput,
  mapDashboardInstanceMagicMcpServersProviderGetOutput,
  mapDashboardInstanceMagicMcpServersProviderListOutput,
  mapDashboardInstanceMagicMcpServersProviderListQuery,
  mapDashboardInstanceMagicMcpServersProviderUpdateBody,
  mapDashboardInstanceMagicMcpServersProviderUpdateOutput,
  type DashboardInstanceMagicMcpServersProviderCreateBody,
  type DashboardInstanceMagicMcpServersProviderCreateOutput,
  type DashboardInstanceMagicMcpServersProviderDeleteOutput,
  type DashboardInstanceMagicMcpServersProviderGetOutput,
  type DashboardInstanceMagicMcpServersProviderListOutput,
  type DashboardInstanceMagicMcpServersProviderListQuery,
  type DashboardInstanceMagicMcpServersProviderUpdateBody,
  type DashboardInstanceMagicMcpServersProviderUpdateOutput
} from '../resources';

/**
 * @name Magic MCP Server Providers controller
 * @description Magic MCP server providers define which providers are included in the setup session template backing a magic MCP server.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceMagicMcpServersProviderEndpoint {
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
   * @param `query` - DashboardInstanceMagicMcpServersProviderListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProviderListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    magicMcpServerId: string,
    query?: DashboardInstanceMagicMcpServersProviderListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProviderListOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/provider`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMagicMcpServersProviderListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersProviderListOutput
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
   * @returns DashboardInstanceMagicMcpServersProviderGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    magicMcpServerId: string,
    magicMcpServerProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProviderGetOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/provider/${magicMcpServerProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpServersProviderGetOutput
    );
  }

  /**
   * @name Create magic MCP server provider
   * @description Adds a new provider configuration to a magic MCP server.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `body` - DashboardInstanceMagicMcpServersProviderCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProviderCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    magicMcpServerId: string,
    body: DashboardInstanceMagicMcpServersProviderCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProviderCreateOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/provider`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpServersProviderCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpServersProviderCreateOutput
    );
  }

  /**
   * @name Update magic MCP server provider
   * @description Updates a provider configuration in a magic MCP server.
   *
   * @param `instanceId` - string
   * @param `magicMcpServerId` - string
   * @param `magicMcpServerProviderId` - string
   * @param `body` - DashboardInstanceMagicMcpServersProviderUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpServersProviderUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    magicMcpServerId: string,
    magicMcpServerProviderId: string,
    body: DashboardInstanceMagicMcpServersProviderUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProviderUpdateOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/provider/${magicMcpServerProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpServersProviderUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceMagicMcpServersProviderUpdateOutput
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
   * @returns DashboardInstanceMagicMcpServersProviderDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    magicMcpServerId: string,
    magicMcpServerProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpServersProviderDeleteOutput> {
    let path = `instances/${instanceId}/magic-mcp-servers/${magicMcpServerId}/provider/${magicMcpServerProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceMagicMcpServersProviderDeleteOutput
    );
  }
}
