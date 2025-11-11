import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpGroupsAddServersBody,
  mapDashboardInstanceMagicMcpGroupsAddServersOutput,
  mapDashboardInstanceMagicMcpGroupsCreateBody,
  mapDashboardInstanceMagicMcpGroupsCreateOutput,
  mapDashboardInstanceMagicMcpGroupsDeleteOutput,
  mapDashboardInstanceMagicMcpGroupsGetOutput,
  mapDashboardInstanceMagicMcpGroupsListOutput,
  mapDashboardInstanceMagicMcpGroupsListQuery,
  mapDashboardInstanceMagicMcpGroupsRemoveServersBody,
  mapDashboardInstanceMagicMcpGroupsRemoveServersOutput,
  mapDashboardInstanceMagicMcpGroupsUpdateBody,
  mapDashboardInstanceMagicMcpGroupsUpdateOutput,
  type DashboardInstanceMagicMcpGroupsAddServersBody,
  type DashboardInstanceMagicMcpGroupsAddServersOutput,
  type DashboardInstanceMagicMcpGroupsCreateBody,
  type DashboardInstanceMagicMcpGroupsCreateOutput,
  type DashboardInstanceMagicMcpGroupsDeleteOutput,
  type DashboardInstanceMagicMcpGroupsGetOutput,
  type DashboardInstanceMagicMcpGroupsListOutput,
  type DashboardInstanceMagicMcpGroupsListQuery,
  type DashboardInstanceMagicMcpGroupsRemoveServersBody,
  type DashboardInstanceMagicMcpGroupsRemoveServersOutput,
  type DashboardInstanceMagicMcpGroupsUpdateBody,
  type DashboardInstanceMagicMcpGroupsUpdateOutput
} from '../resources';

/**
 * @name Magic MCP Group controller
 * @description Before you can connect to an MCP server, you need to create a magic MCP group.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialMagicMcpGroupsEndpoint {
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
   * @name List magic MCP group
   * @description List all magic MCP group
   *
   * @param `query` - DashboardInstanceMagicMcpGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceMagicMcpGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpGroupsListOutput> {
    let path = 'magic-mcp-groups';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMagicMcpGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpGroupsListOutput
    );
  }

  /**
   * @name Get magic MCP group
   * @description Get the information of a specific magic MCP group
   *
   * @param `magicMcpGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    magicMcpGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpGroupsGetOutput> {
    let path = `magic-mcp-groups/${magicMcpGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpGroupsGetOutput
    );
  }

  /**
   * @name Create magic MCP group
   * @description Create a new magic MCP group
   *
   * @param `body` - DashboardInstanceMagicMcpGroupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpGroupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceMagicMcpGroupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpGroupsCreateOutput> {
    let path = 'magic-mcp-groups';

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpGroupsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpGroupsCreateOutput
    );
  }

  /**
   * @name Delete magic MCP group
   * @description Delete a specific magic MCP group
   *
   * @param `magicMcpGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpGroupsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    magicMcpGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpGroupsDeleteOutput> {
    let path = `magic-mcp-groups/${magicMcpGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceMagicMcpGroupsDeleteOutput
    );
  }

  /**
   * @name Update magic MCP group
   * @description Update the information of a specific magic MCP group
   *
   * @param `magicMcpGroupId` - string
   * @param `body` - DashboardInstanceMagicMcpGroupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpGroupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    magicMcpGroupId: string,
    body: DashboardInstanceMagicMcpGroupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpGroupsUpdateOutput> {
    let path = `magic-mcp-groups/${magicMcpGroupId}`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpGroupsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceMagicMcpGroupsUpdateOutput
    );
  }

  /**
   * @name Add servers to magic MCP group
   * @description Add magic MCP servers to a specific magic MCP group
   *
   * @param `magicMcpGroupId` - string
   * @param `body` - DashboardInstanceMagicMcpGroupsAddServersBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpGroupsAddServersOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  addServers(
    magicMcpGroupId: string,
    body: DashboardInstanceMagicMcpGroupsAddServersBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpGroupsAddServersOutput> {
    let path = `magic-mcp-groups/${magicMcpGroupId}/add-servers`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpGroupsAddServersBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpGroupsAddServersOutput
    );
  }

  /**
   * @name Remove servers from magic MCP group
   * @description Remove magic MCP servers from a specific magic MCP group
   *
   * @param `magicMcpGroupId` - string
   * @param `body` - DashboardInstanceMagicMcpGroupsRemoveServersBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpGroupsRemoveServersOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  removeServers(
    magicMcpGroupId: string,
    body: DashboardInstanceMagicMcpGroupsRemoveServersBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpGroupsRemoveServersOutput> {
    let path = `magic-mcp-groups/${magicMcpGroupId}/remove-servers`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpGroupsRemoveServersBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpGroupsRemoveServersOutput
    );
  }
}
