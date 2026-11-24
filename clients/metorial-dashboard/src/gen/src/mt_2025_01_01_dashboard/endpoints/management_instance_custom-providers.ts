import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomProvidersArchiveOutput,
  mapDashboardInstanceCustomProvidersCreateBody,
  mapDashboardInstanceCustomProvidersCreateOutput,
  mapDashboardInstanceCustomProvidersGetEnvOutput,
  mapDashboardInstanceCustomProvidersGetOutput,
  mapDashboardInstanceCustomProvidersListOutput,
  mapDashboardInstanceCustomProvidersListQuery,
  mapDashboardInstanceCustomProvidersUpdateBody,
  mapDashboardInstanceCustomProvidersUpdateOutput,
  type DashboardInstanceCustomProvidersArchiveOutput,
  type DashboardInstanceCustomProvidersCreateBody,
  type DashboardInstanceCustomProvidersCreateOutput,
  type DashboardInstanceCustomProvidersGetEnvOutput,
  type DashboardInstanceCustomProvidersGetOutput,
  type DashboardInstanceCustomProvidersListOutput,
  type DashboardInstanceCustomProvidersListQuery,
  type DashboardInstanceCustomProvidersUpdateBody,
  type DashboardInstanceCustomProvidersUpdateOutput
} from '../resources';

/**
 * @name Custom Providers controller
 * @description A custom provider is an MCP server you deploy and use through your instance. It runs from a container image, a remote URL, or serverless function code.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceCustomProvidersEndpoint {
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
    let path = `instances/${encodeURIComponent(instanceId)}/custom-providers`;

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
   * @description Retrieves a custom provider.
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
    let path = `instances/${encodeURIComponent(instanceId)}/custom-providers/${encodeURIComponent(customProviderId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersGetOutput
    );
  }

  /**
   * @name Get custom provider environment
   * @description Retrieves the environment variables for a custom provider.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersGetEnvOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getEnv(
    instanceId: string,
    customProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersGetEnvOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/custom-providers/${encodeURIComponent(customProviderId)}/env`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersGetEnvOutput
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
    let path = `instances/${encodeURIComponent(instanceId)}/custom-providers`;

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
   * @description Updates a custom provider.
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
    let path = `instances/${encodeURIComponent(instanceId)}/custom-providers/${encodeURIComponent(customProviderId)}`;

    let request = {
      path,
      body: mapDashboardInstanceCustomProvidersUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceCustomProvidersUpdateOutput
    );
  }

  /**
   * @name Archive custom provider
   * @description Archives a custom provider and disables new connections to it.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersArchiveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  archive(
    instanceId: string,
    customProviderId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersArchiveOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/custom-providers/${encodeURIComponent(customProviderId)}/archive`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCustomProvidersArchiveOutput
    );
  }
}
