import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersImplementationsCreateBody,
  mapDashboardInstanceServersImplementationsCreateOutput,
  mapDashboardInstanceServersImplementationsDeleteOutput,
  mapDashboardInstanceServersImplementationsGetOutput,
  mapDashboardInstanceServersImplementationsListOutput,
  mapDashboardInstanceServersImplementationsListQuery,
  mapDashboardInstanceServersImplementationsUpdateBody,
  mapDashboardInstanceServersImplementationsUpdateOutput,
  type DashboardInstanceServersImplementationsCreateBody,
  type DashboardInstanceServersImplementationsCreateOutput,
  type DashboardInstanceServersImplementationsDeleteOutput,
  type DashboardInstanceServersImplementationsGetOutput,
  type DashboardInstanceServersImplementationsListOutput,
  type DashboardInstanceServersImplementationsListQuery,
  type DashboardInstanceServersImplementationsUpdateBody,
  type DashboardInstanceServersImplementationsUpdateOutput
} from '../resources';

/**
 * @name Server Implementation controller
 * @description Server implementations allow you to customize predefined MCP servers with specific configurations, launch parameters, and metadata. You can create server deployments based on these implementations to connect to the underlying MCP servers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersImplementationsEndpoint {
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
   * @name List server implementations
   * @description Retrieve all server implementations in the instance. Supports filtering by status, server, or variant.
   *
   * @param `query` - DashboardInstanceServersImplementationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersImplementationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceServersImplementationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersImplementationsListOutput> {
    let path = 'server-implementations';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceServersImplementationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersImplementationsListOutput
    );
  }

  /**
   * @name Get server implementation
   * @description Fetch detailed information about a specific server implementation.
   *
   * @param `serverImplementationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersImplementationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverImplementationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersImplementationsGetOutput> {
    let path = `server-implementations/${serverImplementationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceServersImplementationsGetOutput
    );
  }

  /**
   * @name Create server implementation
   * @description Create a new server implementation for a specific server or server variant.
   *
   * @param `body` - DashboardInstanceServersImplementationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersImplementationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceServersImplementationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersImplementationsCreateOutput> {
    let path = 'server-implementations';

    let request = {
      path,
      body: mapDashboardInstanceServersImplementationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceServersImplementationsCreateOutput
    );
  }

  /**
   * @name Update server implementation
   * @description Update metadata, launch parameters, or other fields of a server implementation.
   *
   * @param `serverImplementationId` - string
   * @param `body` - DashboardInstanceServersImplementationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersImplementationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    serverImplementationId: string,
    body: DashboardInstanceServersImplementationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersImplementationsUpdateOutput> {
    let path = `server-implementations/${serverImplementationId}`;

    let request = {
      path,
      body: mapDashboardInstanceServersImplementationsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceServersImplementationsUpdateOutput
    );
  }

  /**
   * @name Delete server implementation
   * @description Delete a specific server implementation from the instance.
   *
   * @param `serverImplementationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceServersImplementationsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    serverImplementationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceServersImplementationsDeleteOutput> {
    let path = `server-implementations/${serverImplementationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceServersImplementationsDeleteOutput
    );
  }
}
