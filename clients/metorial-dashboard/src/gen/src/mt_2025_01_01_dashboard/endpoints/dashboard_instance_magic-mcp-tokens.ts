import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpTokensAddGroupsBody,
  mapDashboardInstanceMagicMcpTokensAddGroupsOutput,
  mapDashboardInstanceMagicMcpTokensCreateBody,
  mapDashboardInstanceMagicMcpTokensCreateOutput,
  mapDashboardInstanceMagicMcpTokensDeleteOutput,
  mapDashboardInstanceMagicMcpTokensGetOutput,
  mapDashboardInstanceMagicMcpTokensListOutput,
  mapDashboardInstanceMagicMcpTokensListQuery,
  mapDashboardInstanceMagicMcpTokensRemoveGroupsBody,
  mapDashboardInstanceMagicMcpTokensRemoveGroupsOutput,
  mapDashboardInstanceMagicMcpTokensUpdateBody,
  mapDashboardInstanceMagicMcpTokensUpdateOutput,
  type DashboardInstanceMagicMcpTokensAddGroupsBody,
  type DashboardInstanceMagicMcpTokensAddGroupsOutput,
  type DashboardInstanceMagicMcpTokensCreateBody,
  type DashboardInstanceMagicMcpTokensCreateOutput,
  type DashboardInstanceMagicMcpTokensDeleteOutput,
  type DashboardInstanceMagicMcpTokensGetOutput,
  type DashboardInstanceMagicMcpTokensListOutput,
  type DashboardInstanceMagicMcpTokensListQuery,
  type DashboardInstanceMagicMcpTokensRemoveGroupsBody,
  type DashboardInstanceMagicMcpTokensRemoveGroupsOutput,
  type DashboardInstanceMagicMcpTokensUpdateBody,
  type DashboardInstanceMagicMcpTokensUpdateOutput
} from '../resources';

/**
 * @name Magic MCP Token controller
 * @description Before you can connect to an MCP server, you need to create a magic MCP token.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceMagicMcpTokensEndpoint {
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
   * @name List magic MCP token
   * @description List all magic MCP token
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceMagicMcpTokensListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpTokensListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceMagicMcpTokensListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpTokensListOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-tokens`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMagicMcpTokensListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpTokensListOutput
    );
  }

  /**
   * @name Get magic MCP token
   * @description Get the information of a specific magic MCP token
   *
   * @param `instanceId` - string
   * @param `magicMcpTokenId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpTokensGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    magicMcpTokenId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpTokensGetOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-tokens/${magicMcpTokenId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpTokensGetOutput
    );
  }

  /**
   * @name Create magic MCP token
   * @description Create a new magic MCP token
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceMagicMcpTokensCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpTokensCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceMagicMcpTokensCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpTokensCreateOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-tokens`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpTokensCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpTokensCreateOutput
    );
  }

  /**
   * @name Delete magic MCP token
   * @description Delete a specific magic MCP token
   *
   * @param `instanceId` - string
   * @param `magicMcpTokenId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpTokensDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    magicMcpTokenId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpTokensDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-tokens/${magicMcpTokenId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceMagicMcpTokensDeleteOutput
    );
  }

  /**
   * @name Update magic MCP token
   * @description Update the information of a specific magic MCP token
   *
   * @param `instanceId` - string
   * @param `magicMcpTokenId` - string
   * @param `body` - DashboardInstanceMagicMcpTokensUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpTokensUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    magicMcpTokenId: string,
    body: DashboardInstanceMagicMcpTokensUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpTokensUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-tokens/${magicMcpTokenId}`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpTokensUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceMagicMcpTokensUpdateOutput
    );
  }

  /**
   * @name Add magic MCP groups to token
   * @description Add magic MCP groups to a specific magic MCP token
   *
   * @param `instanceId` - string
   * @param `magicMcpTokenId` - string
   * @param `body` - DashboardInstanceMagicMcpTokensAddGroupsBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpTokensAddGroupsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  addGroups(
    instanceId: string,
    magicMcpTokenId: string,
    body: DashboardInstanceMagicMcpTokensAddGroupsBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpTokensAddGroupsOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-tokens/${magicMcpTokenId}/add-groups`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpTokensAddGroupsBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpTokensAddGroupsOutput
    );
  }

  /**
   * @name Remove magic MCP groups from token
   * @description Remove magic MCP groups from a specific magic MCP token
   *
   * @param `instanceId` - string
   * @param `magicMcpTokenId` - string
   * @param `body` - DashboardInstanceMagicMcpTokensRemoveGroupsBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpTokensRemoveGroupsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  removeGroups(
    instanceId: string,
    magicMcpTokenId: string,
    body: DashboardInstanceMagicMcpTokensRemoveGroupsBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpTokensRemoveGroupsOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-tokens/${magicMcpTokenId}/remove-groups`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpTokensRemoveGroupsBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpTokensRemoveGroupsOutput
    );
  }
}
