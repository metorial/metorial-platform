import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapManagementInstanceProviderDeploymentsSetupSessionsCreateBody,
  mapManagementInstanceProviderDeploymentsSetupSessionsCreateOutput,
  mapManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput,
  mapManagementInstanceProviderDeploymentsSetupSessionsGetOutput,
  mapManagementInstanceProviderDeploymentsSetupSessionsListOutput,
  mapManagementInstanceProviderDeploymentsSetupSessionsListQuery,
  mapManagementInstanceProviderDeploymentsSetupSessionsUpdateBody,
  mapManagementInstanceProviderDeploymentsSetupSessionsUpdateOutput,
  type ManagementInstanceProviderDeploymentsSetupSessionsCreateBody,
  type ManagementInstanceProviderDeploymentsSetupSessionsCreateOutput,
  type ManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput,
  type ManagementInstanceProviderDeploymentsSetupSessionsGetOutput,
  type ManagementInstanceProviderDeploymentsSetupSessionsListOutput,
  type ManagementInstanceProviderDeploymentsSetupSessionsListQuery,
  type ManagementInstanceProviderDeploymentsSetupSessionsUpdateBody,
  type ManagementInstanceProviderDeploymentsSetupSessionsUpdateOutput
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
   * @param `providerDeploymentId` - string
   * @param `query` - ManagementInstanceProviderDeploymentsSetupSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementInstanceProviderDeploymentsSetupSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    providerDeploymentId: string,
    query?: ManagementInstanceProviderDeploymentsSetupSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementInstanceProviderDeploymentsSetupSessionsListOutput> {
    let path = `instances/${instanceId}/provider-deployments/${providerDeploymentId}/setup-sessions`;

    let request = {
      path,

      query: query
        ? mapManagementInstanceProviderDeploymentsSetupSessionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapManagementInstanceProviderDeploymentsSetupSessionsListOutput
    );
  }

  /**
   * @name Get provider setup session
   * @description Retrieves a specific provider setup session by ID.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerSetupSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementInstanceProviderDeploymentsSetupSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerDeploymentId: string,
    providerSetupSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementInstanceProviderDeploymentsSetupSessionsGetOutput> {
    let path = `instances/${instanceId}/provider-deployments/${providerDeploymentId}/setup-sessions/${providerSetupSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapManagementInstanceProviderDeploymentsSetupSessionsGetOutput
    );
  }

  /**
   * @name Create provider setup session
   * @description Creates a new provider setup session for OAuth authentication.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `body` - ManagementInstanceProviderDeploymentsSetupSessionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementInstanceProviderDeploymentsSetupSessionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    providerDeploymentId: string,
    body: ManagementInstanceProviderDeploymentsSetupSessionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementInstanceProviderDeploymentsSetupSessionsCreateOutput> {
    let path = `instances/${instanceId}/provider-deployments/${providerDeploymentId}/setup-sessions`;

    let request = {
      path,
      body: mapManagementInstanceProviderDeploymentsSetupSessionsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapManagementInstanceProviderDeploymentsSetupSessionsCreateOutput
    );
  }

  /**
   * @name Update provider setup session
   * @description Updates a specific provider setup session.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerSetupSessionId` - string
   * @param `body` - ManagementInstanceProviderDeploymentsSetupSessionsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementInstanceProviderDeploymentsSetupSessionsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    providerDeploymentId: string,
    providerSetupSessionId: string,
    body: ManagementInstanceProviderDeploymentsSetupSessionsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementInstanceProviderDeploymentsSetupSessionsUpdateOutput> {
    let path = `instances/${instanceId}/provider-deployments/${providerDeploymentId}/setup-sessions/${providerSetupSessionId}`;

    let request = {
      path,
      body: mapManagementInstanceProviderDeploymentsSetupSessionsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapManagementInstanceProviderDeploymentsSetupSessionsUpdateOutput
    );
  }

  /**
   * @name Delete provider setup session
   * @description Deletes a provider setup session.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `providerSetupSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    providerDeploymentId: string,
    providerSetupSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput> {
    let path = `instances/${instanceId}/provider-deployments/${providerDeploymentId}/setup-sessions/${providerSetupSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput
    );
  }
}
