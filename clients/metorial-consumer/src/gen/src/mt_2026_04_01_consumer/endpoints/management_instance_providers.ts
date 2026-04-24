import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersGetOutput,
  mapDashboardInstanceProvidersListOutput,
  mapDashboardInstanceProvidersListQuery,
  type DashboardInstanceProvidersGetOutput,
  type DashboardInstanceProvidersListOutput,
  type DashboardInstanceProvidersListQuery
} from '../resources';

/**
 * @name Providers controller
 * @description A provider is a read-only template for an MCP server integration (like GitHub or Slack). To use a provider, create a deployment from it.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProvidersEndpoint {
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
   * @name List providers
   * @description Returns a paginated list of providers.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersListOutput> {
    let path = `instances/${instanceId}/providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersListOutput
    );
  }

  /**
   * @name Get provider
   * @description Retrieves a specific provider by ID.
   *
   * @param `instanceId` - string
   * @param `providerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersGetOutput> {
    let path = `instances/${instanceId}/providers/${providerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceProvidersGetOutput);
  }
}
