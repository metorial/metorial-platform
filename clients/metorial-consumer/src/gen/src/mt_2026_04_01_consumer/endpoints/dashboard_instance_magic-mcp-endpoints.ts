import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMagicMcpEndpointsAddServersBody,
  mapDashboardInstanceMagicMcpEndpointsAddServersOutput,
  mapDashboardInstanceMagicMcpEndpointsCreateBody,
  mapDashboardInstanceMagicMcpEndpointsCreateOutput,
  mapDashboardInstanceMagicMcpEndpointsDeleteOutput,
  mapDashboardInstanceMagicMcpEndpointsGetOutput,
  mapDashboardInstanceMagicMcpEndpointsListOutput,
  mapDashboardInstanceMagicMcpEndpointsListQuery,
  mapDashboardInstanceMagicMcpEndpointsRemoveServersBody,
  mapDashboardInstanceMagicMcpEndpointsRemoveServersOutput,
  mapDashboardInstanceMagicMcpEndpointsUpdateBody,
  mapDashboardInstanceMagicMcpEndpointsUpdateOutput,
  type DashboardInstanceMagicMcpEndpointsAddServersBody,
  type DashboardInstanceMagicMcpEndpointsAddServersOutput,
  type DashboardInstanceMagicMcpEndpointsCreateBody,
  type DashboardInstanceMagicMcpEndpointsCreateOutput,
  type DashboardInstanceMagicMcpEndpointsDeleteOutput,
  type DashboardInstanceMagicMcpEndpointsGetOutput,
  type DashboardInstanceMagicMcpEndpointsListOutput,
  type DashboardInstanceMagicMcpEndpointsListQuery,
  type DashboardInstanceMagicMcpEndpointsRemoveServersBody,
  type DashboardInstanceMagicMcpEndpointsRemoveServersOutput,
  type DashboardInstanceMagicMcpEndpointsUpdateBody,
  type DashboardInstanceMagicMcpEndpointsUpdateOutput
} from '../resources';

/**
 * @name Magic MCP Endpoints controller
 * @description Magic MCP endpoints combine multiple Magic MCP servers behind one routed connection target.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceMagicMcpEndpointsEndpoint {
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
   * @name List magic MCP endpoints
   * @description Returns a paginated list of magic MCP endpoints.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceMagicMcpEndpointsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpEndpointsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceMagicMcpEndpointsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpEndpointsListOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-endpoints`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMagicMcpEndpointsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpEndpointsListOutput
    );
  }

  /**
   * @name Get magic MCP endpoint
   * @description Retrieves a specific magic MCP endpoint.
   *
   * @param `instanceId` - string
   * @param `magicMcpEndpointId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpEndpointsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    magicMcpEndpointId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpEndpointsGetOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-endpoints/${magicMcpEndpointId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMagicMcpEndpointsGetOutput
    );
  }

  /**
   * @name Create magic MCP endpoint
   * @description Creates a magic MCP endpoint.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceMagicMcpEndpointsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpEndpointsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceMagicMcpEndpointsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpEndpointsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-endpoints`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpEndpointsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpEndpointsCreateOutput
    );
  }

  /**
   * @name Delete magic MCP endpoint
   * @description Archives a magic MCP endpoint.
   *
   * @param `instanceId` - string
   * @param `magicMcpEndpointId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpEndpointsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    magicMcpEndpointId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpEndpointsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-endpoints/${magicMcpEndpointId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceMagicMcpEndpointsDeleteOutput
    );
  }

  /**
   * @name Update magic MCP endpoint
   * @description Updates a magic MCP endpoint.
   *
   * @param `instanceId` - string
   * @param `magicMcpEndpointId` - string
   * @param `body` - DashboardInstanceMagicMcpEndpointsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpEndpointsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    magicMcpEndpointId: string,
    body: DashboardInstanceMagicMcpEndpointsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpEndpointsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-endpoints/${magicMcpEndpointId}`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpEndpointsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceMagicMcpEndpointsUpdateOutput
    );
  }

  /**
   * @name Add servers to magic MCP endpoint
   * @description Adds magic MCP servers to a magic MCP endpoint.
   *
   * @param `instanceId` - string
   * @param `magicMcpEndpointId` - string
   * @param `body` - DashboardInstanceMagicMcpEndpointsAddServersBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpEndpointsAddServersOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  addServers(
    instanceId: string,
    magicMcpEndpointId: string,
    body: DashboardInstanceMagicMcpEndpointsAddServersBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpEndpointsAddServersOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-endpoints/${magicMcpEndpointId}/add-servers`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpEndpointsAddServersBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpEndpointsAddServersOutput
    );
  }

  /**
   * @name Remove servers from magic MCP endpoint
   * @description Removes magic MCP servers from a magic MCP endpoint.
   *
   * @param `instanceId` - string
   * @param `magicMcpEndpointId` - string
   * @param `body` - DashboardInstanceMagicMcpEndpointsRemoveServersBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMagicMcpEndpointsRemoveServersOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  removeServers(
    instanceId: string,
    magicMcpEndpointId: string,
    body: DashboardInstanceMagicMcpEndpointsRemoveServersBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMagicMcpEndpointsRemoveServersOutput> {
    let path = `dashboard/instances/${instanceId}/magic-mcp-endpoints/${magicMcpEndpointId}/remove-servers`;

    let request = {
      path,
      body: mapDashboardInstanceMagicMcpEndpointsRemoveServersBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMagicMcpEndpointsRemoveServersOutput
    );
  }
}
