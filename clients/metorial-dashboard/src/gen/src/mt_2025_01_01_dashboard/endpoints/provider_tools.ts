import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderToolsGetOutput,
  mapDashboardInstanceProviderToolsListOutput,
  mapDashboardInstanceProviderToolsListQuery,
  type DashboardInstanceProviderToolsGetOutput,
  type DashboardInstanceProviderToolsListOutput,
  type DashboardInstanceProviderToolsListQuery
} from '../resources';

/**
 * @name Provider Tools controller
 * @description A tool is a single action a provider can perform like 'search_issues' or 'send_message'. Tools are what AI agents call via MCP. By default, tools from the latest provider version are returned. Use the optional version filter to get tools for a specific version.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderToolsEndpoint {
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
   * @param `query` - DashboardInstanceProviderToolsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderToolsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderToolsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderToolsListOutput> {
    let path = 'provider-tools';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderToolsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderToolsListOutput
    );
  }

  /**
   * @name Get provider tool
   * @description Retrieves a specific provider tool by ID.
   *
   * @param `providerToolId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderToolsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerToolId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderToolsGetOutput> {
    let path = `provider-tools/${providerToolId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderToolsGetOutput
    );
  }
}
