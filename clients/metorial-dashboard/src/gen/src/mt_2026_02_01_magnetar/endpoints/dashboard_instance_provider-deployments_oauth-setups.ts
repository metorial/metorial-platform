import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsOauthSetupsCreateBody,
  mapDashboardInstanceProviderDeploymentsOauthSetupsCreateOutput,
  mapDashboardInstanceProviderDeploymentsOauthSetupsGetOutput,
  mapDashboardInstanceProviderDeploymentsOauthSetupsListOutput,
  mapDashboardInstanceProviderDeploymentsOauthSetupsListQuery,
  mapDashboardInstanceProviderDeploymentsOauthSetupsUpdateBody,
  mapDashboardInstanceProviderDeploymentsOauthSetupsUpdateOutput,
  type DashboardInstanceProviderDeploymentsOauthSetupsCreateBody,
  type DashboardInstanceProviderDeploymentsOauthSetupsCreateOutput,
  type DashboardInstanceProviderDeploymentsOauthSetupsGetOutput,
  type DashboardInstanceProviderDeploymentsOauthSetupsListOutput,
  type DashboardInstanceProviderDeploymentsOauthSetupsListQuery,
  type DashboardInstanceProviderDeploymentsOauthSetupsUpdateBody,
  type DashboardInstanceProviderDeploymentsOauthSetupsUpdateOutput
} from '../resources';

/**
 * @name Provider OAuth Setups controller
 * @description OAuth setups provide a way to authenticate users with providers that require OAuth. Create a setup, send users to the URL, and an auth config is created when they complete the flow.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderDeploymentsOauthSetupsEndpoint {
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
   * @name List OAuth setups
   * @description Returns a paginated list of OAuth setups for a provider deployment.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsOauthSetupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsOauthSetupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    providerDeploymentId: string,
    query?: DashboardInstanceProviderDeploymentsOauthSetupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsOauthSetupsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/oauth-setups`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsOauthSetupsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsOauthSetupsListOutput
    );
  }

  /**
   * @name Get OAuth setup
   * @description Retrieves a specific OAuth setup by ID.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerOAuthSetupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsOauthSetupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerDeploymentId: string,
    providerOAuthSetupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsOauthSetupsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/oauth-setups/${providerOAuthSetupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsOauthSetupsGetOutput
    );
  }

  /**
   * @name Create OAuth setup
   * @description Creates a new OAuth setup. Returns a URL that users should visit to complete the OAuth flow.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsOauthSetupsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsOauthSetupsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    providerDeploymentId: string,
    body: DashboardInstanceProviderDeploymentsOauthSetupsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsOauthSetupsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/oauth-setups`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsOauthSetupsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsOauthSetupsCreateOutput
    );
  }

  /**
   * @name Update OAuth setup
   * @description Updates an existing OAuth setup.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerOAuthSetupId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsOauthSetupsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsOauthSetupsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    providerDeploymentId: string,
    providerOAuthSetupId: string,
    body: DashboardInstanceProviderDeploymentsOauthSetupsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsOauthSetupsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}/oauth-setups/${providerOAuthSetupId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsOauthSetupsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderDeploymentsOauthSetupsUpdateOutput
    );
  }
}
