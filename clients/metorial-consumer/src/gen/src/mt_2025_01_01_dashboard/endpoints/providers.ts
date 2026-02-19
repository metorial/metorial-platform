import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersGetOutput,
  mapDashboardInstanceProvidersListOutput,
  mapDashboardInstanceProvidersListQuery,
  mapDashboardInstanceProvidersUpdateBody,
  mapDashboardInstanceProvidersUpdateOutput,
  type DashboardInstanceProvidersGetOutput,
  type DashboardInstanceProvidersListOutput,
  type DashboardInstanceProvidersListQuery,
  type DashboardInstanceProvidersUpdateBody,
  type DashboardInstanceProvidersUpdateOutput
} from '../resources';

/**
 * @name Providers controller
 * @description A provider is a read-only template for an MCP server integration (like GitHub or Slack). To use a provider, create a deployment from it.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProvidersEndpoint {
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
   * @param `query` - DashboardInstanceProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersListOutput> {
    let path = 'providers';

    let request = {
      path,

      query: query ? mapDashboardInstanceProvidersListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceProvidersListOutput);
  }

  /**
   * @name Get provider
   * @description Retrieves a specific provider by ID.
   *
   * @param `providerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersGetOutput> {
    let path = `providers/${providerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceProvidersGetOutput);
  }

  /**
   * @name Update provider
   * @description Updates a provider.
   *
   * @param `providerId` - string
   * @param `body` - DashboardInstanceProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    providerId: string,
    body: DashboardInstanceProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersUpdateOutput> {
    let path = `providers/${providerId}`;

    let request = {
      path,
      body: mapDashboardInstanceProvidersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceProvidersUpdateOutput);
  }
}
