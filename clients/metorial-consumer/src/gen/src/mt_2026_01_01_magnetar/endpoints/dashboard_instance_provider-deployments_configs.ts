import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsConfigsCreateBody,
  mapDashboardInstanceProviderDeploymentsConfigsCreateOutput,
  mapDashboardInstanceProviderDeploymentsConfigsDeleteOutput,
  mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput,
  mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery,
  mapDashboardInstanceProviderDeploymentsConfigsGetOutput,
  mapDashboardInstanceProviderDeploymentsConfigsListOutput,
  mapDashboardInstanceProviderDeploymentsConfigsListQuery,
  mapDashboardInstanceProviderDeploymentsConfigsUpdateBody,
  mapDashboardInstanceProviderDeploymentsConfigsUpdateOutput,
  type DashboardInstanceProviderDeploymentsConfigsCreateBody,
  type DashboardInstanceProviderDeploymentsConfigsCreateOutput,
  type DashboardInstanceProviderDeploymentsConfigsDeleteOutput,
  type DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput,
  type DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery,
  type DashboardInstanceProviderDeploymentsConfigsGetOutput,
  type DashboardInstanceProviderDeploymentsConfigsListOutput,
  type DashboardInstanceProviderDeploymentsConfigsListQuery,
  type DashboardInstanceProviderDeploymentsConfigsUpdateBody,
  type DashboardInstanceProviderDeploymentsConfigsUpdateOutput
} from '../resources';

/**
 * @name Provider Configs controller
 * @description A config holds settings for a deployment, like API endpoints or feature flags. Create configs with values directly, or from a saved config vault with pre-saved values.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint {
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
   * @name List provider configs
   * @description Returns a paginated list of provider configs.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsConfigsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsConfigsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-configs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsConfigsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigsListOutput
    );
  }

  /**
   * @name Get provider config
   * @description Retrieves a specific provider config by ID.
   *
   * @param `instanceId` - string
   * @param `providerConfigId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerConfigId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-configs/${providerConfigId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigsGetOutput
    );
  }

  /**
   * @name Create provider config
   * @description Creates a new provider config.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsConfigsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderDeploymentsConfigsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-configs`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsConfigsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigsCreateOutput
    );
  }

  /**
   * @name Update provider config
   * @description Updates a specific provider config.
   *
   * @param `instanceId` - string
   * @param `providerConfigId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsConfigsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    providerConfigId: string,
    body: DashboardInstanceProviderDeploymentsConfigsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-configs/${providerConfigId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsConfigsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigsUpdateOutput
    );
  }

  /**
   * @name Delete provider config
   * @description Permanently deletes a provider config.
   *
   * @param `instanceId` - string
   * @param `providerConfigId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    providerConfigId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/provider-configs/${providerConfigId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigsDeleteOutput
    );
  }

  /**
   * @name Get config schema
   * @description Retrieves the JSON Schema for configuration of this provider deployment.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getConfigSchema(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput> {
    let path = `dashboard/instances/${instanceId}/provider-config-schema`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput
    );
  }
}
