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
 * @description Auth credentials store your OAuth app registration (client ID, client secret, and scopes). These are the app-level credentials you get from a service like GitHub or Slack.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderDeploymentsAuthCredentialsEndpoint {
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
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsAuthCredentialsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsAuthCredentialsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsListOutput> {
    let path = `instances/${instanceId}/provider-auth-credentials`;

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
   * @description Retrieves specific provider auth credentials by ID.
   *
   * @param `instanceId` - string
   * @param `providerAuthCredentialsId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerAuthCredentialsId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput> {
    let path = `instances/${instanceId}/provider-auth-credentials/${providerAuthCredentialsId}`;

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
   * @description Creates new provider auth credentials.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput> {
    let path = `instances/${instanceId}/provider-auth-credentials`;

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
   * @description Updates specific provider auth credentials.
   *
   * @param `instanceId` - string
   * @param `providerAuthCredentialsId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    providerAuthCredentialsId: string,
    body: DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput> {
    let path = `instances/${instanceId}/provider-auth-credentials/${providerAuthCredentialsId}`;

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
   * @name Delete provider auth credentials
   * @description Permanently deletes provider auth credentials.
   *
   * @param `instanceId` - string
   * @param `providerAuthCredentialsId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    providerAuthCredentialsId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput> {
    let path = `instances/${instanceId}/provider-auth-credentials/${providerAuthCredentialsId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderDeploymentsAuthCredentialsDeleteOutput
    );
  }
}
