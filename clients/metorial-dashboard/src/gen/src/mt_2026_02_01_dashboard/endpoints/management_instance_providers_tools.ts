import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersToolsGetOutput,
  mapDashboardInstanceProvidersToolsListOutput,
  mapDashboardInstanceProvidersToolsListQuery,
  type DashboardInstanceProvidersToolsGetOutput,
  type DashboardInstanceProvidersToolsListOutput,
  type DashboardInstanceProvidersToolsListQuery
} from '../resources';

/**
 * @name Provider Tools controller
 * @description A tool is a single action a provider can perform like 'search_issues' or 'send_message'. Tools are what AI agents call via MCP. By default, tools from the latest provider version are returned. Use the optional version filter to get tools for a specific version.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProvidersToolsEndpoint {
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
   * @name List provider tools
   * @description Returns a paginated list of provider tools. By default returns tools from the latest version. Use optional filters to get tools for a specific version.
   *
   * @param `instanceId` - string
   * @param `providerId` - string
   * @param `query` - DashboardInstanceProvidersToolsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersToolsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    providerId: string,
    query?: DashboardInstanceProvidersToolsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersToolsListOutput> {
    let path = `instances/${instanceId}/providers/${providerId}/tools`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersToolsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersToolsListOutput
    );
  }

  /**
   * @name Get provider tool
   * @description Retrieves a specific provider tool by ID.
   *
   * @param `instanceId` - string
   * @param `providerId` - string
   * @param `providerToolId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersToolsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerId: string,
    providerToolId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersToolsGetOutput> {
    let path = `instances/${instanceId}/providers/${providerId}/tools/${providerToolId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersToolsGetOutput
    );
  }
}
