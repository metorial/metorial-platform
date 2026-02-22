import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsSetupSessionsCreateBody,
  mapDashboardInstanceProviderDeploymentsSetupSessionsCreateOutput,
  mapDashboardInstanceProviderDeploymentsSetupSessionsDeleteOutput,
  mapDashboardInstanceProviderDeploymentsSetupSessionsGetOutput,
  mapDashboardInstanceProviderDeploymentsSetupSessionsListOutput,
  mapDashboardInstanceProviderDeploymentsSetupSessionsListQuery,
  mapDashboardInstanceProviderDeploymentsSetupSessionsUpdateBody,
  mapDashboardInstanceProviderDeploymentsSetupSessionsUpdateOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsCreateBody,
  type DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsDeleteOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsGetOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsListOutput,
  type DashboardInstanceProviderDeploymentsSetupSessionsListQuery,
  type DashboardInstanceProviderDeploymentsSetupSessionsUpdateBody,
  type DashboardInstanceProviderDeploymentsSetupSessionsUpdateOutput
} from '../resources';

/**
 * @name Provider Setup Sessions controller
 * @description A setup session tracks an in-progress OAuth flow, storing state during the redirect. On success, it creates an auth config with the user's access token.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderDeploymentsSetupSessionsEndpoint {
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
   * @name List provider setup sessions
   * @description Returns a paginated list of provider setup sessions.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsSetupSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsSetupSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsListOutput> {
    let path = `instances/${instanceId}/provider-setup-sessions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsSetupSessionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsSetupSessionsListOutput
    );
  }

  /**
   * @name Get provider setup session
   * @description Retrieves a specific provider setup session by ID.
   *
   * @param `instanceId` - string
   * @param `providerSetupSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerSetupSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsGetOutput> {
    let path = `instances/${instanceId}/provider-setup-sessions/${providerSetupSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsSetupSessionsGetOutput
    );
  }

  /**
   * @name Create provider setup session
   * @description Creates a new provider setup session for OAuth authentication.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsSetupSessionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderDeploymentsSetupSessionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput> {
    let path = `instances/${instanceId}/provider-setup-sessions`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsSetupSessionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsSetupSessionsCreateOutput
    );
  }

  /**
   * @name Update provider setup session
   * @description Updates a specific provider setup session.
   *
   * @param `instanceId` - string
   * @param `providerSetupSessionId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsSetupSessionsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    providerSetupSessionId: string,
    body: DashboardInstanceProviderDeploymentsSetupSessionsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsUpdateOutput> {
    let path = `instances/${instanceId}/provider-setup-sessions/${providerSetupSessionId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsSetupSessionsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderDeploymentsSetupSessionsUpdateOutput
    );
  }

  /**
   * @name Delete provider setup session
   * @description Deletes a provider setup session.
   *
   * @param `instanceId` - string
   * @param `providerSetupSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsSetupSessionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    providerSetupSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsSetupSessionsDeleteOutput> {
    let path = `instances/${instanceId}/provider-setup-sessions/${providerSetupSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderDeploymentsSetupSessionsDeleteOutput
    );
  }
}
