import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderDeploymentsCreateBody,
  mapDashboardInstanceProviderDeploymentsCreateOutput,
  mapDashboardInstanceProviderDeploymentsDeleteOutput,
  mapDashboardInstanceProviderDeploymentsGetOutput,
  mapDashboardInstanceProviderDeploymentsListOutput,
  mapDashboardInstanceProviderDeploymentsListQuery,
  mapDashboardInstanceProviderDeploymentsUpdateBody,
  mapDashboardInstanceProviderDeploymentsUpdateOutput,
  type DashboardInstanceProviderDeploymentsCreateBody,
  type DashboardInstanceProviderDeploymentsCreateOutput,
  type DashboardInstanceProviderDeploymentsDeleteOutput,
  type DashboardInstanceProviderDeploymentsGetOutput,
  type DashboardInstanceProviderDeploymentsListOutput,
  type DashboardInstanceProviderDeploymentsListQuery,
  type DashboardInstanceProviderDeploymentsUpdateBody,
  type DashboardInstanceProviderDeploymentsUpdateOutput
} from '../resources';

/**
 * @name Provider Deployments controller
 * @description A deployment is a running instance of a provider, pinned to a specific version. Deployments support custom configuration values and user authentication.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderDeploymentsEndpoint {
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
   * @name List provider deployments
   * @description Returns a paginated list of provider deployments.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderDeploymentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderDeploymentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderDeploymentsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsListOutput
    );
  }

  /**
   * @name Get provider deployment
   * @description Retrieves a specific provider deployment by ID.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderDeploymentsGetOutput
    );
  }

  /**
   * @name Create provider deployment
   * @description Creates a new provider deployment.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderDeploymentsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderDeploymentsCreateOutput
    );
  }

  /**
   * @name Update provider deployment
   * @description Updates a specific provider deployment.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `body` - DashboardInstanceProviderDeploymentsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    providerDeploymentId: string,
    body: DashboardInstanceProviderDeploymentsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderDeploymentsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderDeploymentsUpdateOutput
    );
  }

  /**
   * @name Delete provider deployment
   * @description Permanently deletes a provider deployment.
   *
   * @param `instanceId` - string
   * @param `providerDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderDeploymentsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    providerDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderDeploymentsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/provider-deployments/${providerDeploymentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderDeploymentsDeleteOutput
    );
  }
}
