import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsAuthCredentialsCreateBody,
  mapDashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput,
  mapDashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput,
  mapDashboardInstanceProviderDeploymentsAuthCredentialsGetOutput,
  mapDashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  mapDashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
  mapDashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody,
  mapDashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput,
  type DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody,
  type DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput,
  type DashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput,
  type DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput,
  type DashboardInstanceProviderDeploymentsAuthCredentialsListOutput,
  type DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
  type DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody,
  type DashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput
} from '../resources';

/**
 * @name Provider Auth Credentials controller
 * @description Provider auth credentials are an OAuth app registration used with a provider: a client ID, a client secret, and scopes.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderDeploymentsAuthCredentialsEndpoint {
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
   * @name List provider auth credentials
   * @description Returns a paginated list of provider auth credentials.
   *
   * @param `query` - DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsListOutput> {
    let path = 'provider-auth-credentials';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsAuthCredentialsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthCredentialsListOutput
    );
  }

  /**
   * @name Get provider auth credentials
   * @description Retrieves provider auth credentials.
   *
   * @param `providerAuthCredentialsId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerAuthCredentialsId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput> {
    let path = `provider-auth-credentials/${encodeURIComponent(providerAuthCredentialsId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthCredentialsGetOutput
    );
  }

  /**
   * @name Create provider auth credentials
   * @description Creates provider auth credentials.
   *
   * @param `body` - DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput> {
    let path = 'provider-auth-credentials';

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsAuthCredentialsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput
    );
  }

  /**
   * @name Update provider auth credentials
   * @description Updates provider auth credentials.
   *
   * @param `providerAuthCredentialsId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    providerAuthCredentialsId: string,
    body: DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput> {
    let path = `provider-auth-credentials/${encodeURIComponent(providerAuthCredentialsId)}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput
    );
  }

  /**
   * @name Archive provider auth credentials
   * @description Archives provider auth credentials. They stay listable with `status=archived`.
   *
   * @param `providerAuthCredentialsId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    providerAuthCredentialsId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput> {
    let path = `provider-auth-credentials/${encodeURIComponent(providerAuthCredentialsId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput
    );
  }
}
