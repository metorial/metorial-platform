import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomProvidersCreateBody,
  mapDashboardInstanceCustomProvidersCreateOutput,
  mapDashboardInstanceCustomProvidersGetOutput,
  mapDashboardInstanceCustomProvidersListOutput,
  mapDashboardInstanceCustomProvidersListQuery,
  mapDashboardInstanceCustomProvidersUpdateBody,
  mapDashboardInstanceCustomProvidersUpdateOutput,
  type DashboardInstanceCustomProvidersCreateBody,
  type DashboardInstanceCustomProvidersCreateOutput,
  type DashboardInstanceCustomProvidersGetOutput,
  type DashboardInstanceCustomProvidersListOutput,
  type DashboardInstanceCustomProvidersListQuery,
  type DashboardInstanceCustomProvidersUpdateBody,
  type DashboardInstanceCustomProvidersUpdateOutput
} from '../resources';

/**
 * @name Custom Providers controller
 * @description Custom providers allow you to deploy your own MCP servers. Create providers from container images, remote URLs, or serverless functions.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCustomProvidersEndpoint {
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
   * @name List custom providers
   * @description Returns a paginated list of custom providers.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceCustomProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceCustomProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersListOutput> {
    let path = `dashboard/instances/${instanceId}/custom-providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersListOutput
    );
  }

  /**
   * @name Get custom provider
   * @description Retrieves a specific custom provider by ID.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    customProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersGetOutput> {
    let path = `dashboard/instances/${instanceId}/custom-providers/${customProviderId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersGetOutput
    );
  }

  /**
   * @name Create custom provider
   * @description Creates a new custom provider.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceCustomProvidersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceCustomProvidersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersCreateOutput> {
    let path = `dashboard/instances/${instanceId}/custom-providers`;

    let request = {
      path,
      body: mapDashboardInstanceCustomProvidersCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCustomProvidersCreateOutput
    );
  }

  /**
   * @name Update custom provider
   * @description Updates a specific custom provider.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `body` - DashboardInstanceCustomProvidersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    customProviderId: string,
    body: DashboardInstanceCustomProvidersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/custom-providers/${customProviderId}`;

    let request = {
      path,
      body: mapDashboardInstanceCustomProvidersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceCustomProvidersUpdateOutput
    );
  }
}
