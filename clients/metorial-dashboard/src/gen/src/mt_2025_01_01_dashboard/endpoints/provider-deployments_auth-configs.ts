import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsAuthConfigsCreateBody,
  mapDashboardInstanceProviderDeploymentsAuthConfigsCreateOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsDeleteOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsGetOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsListOutput,
  mapDashboardInstanceProviderDeploymentsAuthConfigsListQuery,
  mapDashboardInstanceProviderDeploymentsAuthConfigsUpdateBody,
  mapDashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsCreateBody,
  type DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsDeleteOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsGetOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsListOutput,
  type DashboardInstanceProviderDeploymentsAuthConfigsListQuery,
  type DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody,
  type DashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput
} from '../resources';

/**
 * @name Provider Auth Configs controller
 * @description An auth config is a user's authenticated connection to a provider. Created when a user completes OAuth or manually enters an API token.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderDeploymentsAuthConfigsEndpoint {
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
   * @name List provider auth configs
   * @description Returns a paginated list of provider auth configs.
   *
   * @param `query` - DashboardInstanceProviderDeploymentsAuthConfigsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderDeploymentsAuthConfigsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsListOutput> {
    let path = 'provider-auth-configs';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsAuthConfigsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsListOutput
    );
  }

  /**
   * @name Get provider auth config
   * @description Retrieves a specific provider auth config by ID.
   *
   * @param `providerAuthConfigId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerAuthConfigId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsGetOutput> {
    let path = `provider-auth-configs/${providerAuthConfigId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsGetOutput
    );
  }

  /**
   * @name Create provider auth config
   * @description Creates a new provider auth config.
   *
   * @param `body` - DashboardInstanceProviderDeploymentsAuthConfigsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProviderDeploymentsAuthConfigsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput> {
    let path = 'provider-auth-configs';

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsAuthConfigsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsCreateOutput
    );
  }

  /**
   * @name Update provider auth config
   * @description Updates a specific provider auth config.
   *
   * @param `providerAuthConfigId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    providerAuthConfigId: string,
    body: DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput> {
    let path = `provider-auth-configs/${providerAuthConfigId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsAuthConfigsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput
    );
  }

  /**
   * @name Delete provider auth config
   * @description Permanently deletes a provider auth config.
   *
   * @param `providerAuthConfigId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthConfigsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    providerAuthConfigId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthConfigsDeleteOutput> {
    let path = `provider-auth-configs/${providerAuthConfigId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthConfigsDeleteOutput
    );
  }
}
