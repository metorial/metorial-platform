import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomProvidersDeploymentsGetLogsOutput,
  mapDashboardInstanceCustomProvidersDeploymentsGetOutput,
  mapDashboardInstanceCustomProvidersDeploymentsListOutput,
  mapDashboardInstanceCustomProvidersDeploymentsListQuery,
  type DashboardInstanceCustomProvidersDeploymentsGetLogsOutput,
  type DashboardInstanceCustomProvidersDeploymentsGetOutput,
  type DashboardInstanceCustomProvidersDeploymentsListOutput,
  type DashboardInstanceCustomProvidersDeploymentsListQuery
} from '../resources';

/**
 * @name Custom Provider Deployments controller
 * @description A custom provider deployment is a build and rollout of one custom provider version.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomProvidersDeploymentsEndpoint {
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
   * @name List custom provider deployments
   * @description Returns a paginated list of custom provider deployments.
   *
   * @param `query` - DashboardInstanceCustomProvidersDeploymentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersDeploymentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceCustomProvidersDeploymentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersDeploymentsListOutput> {
    let path = 'custom-provider-deployments';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomProvidersDeploymentsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersDeploymentsListOutput
    );
  }

  /**
   * @name Get custom provider deployment
   * @description Retrieves a custom provider deployment.
   *
   * @param `customProviderDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersDeploymentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    customProviderDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersDeploymentsGetOutput> {
    let path = `custom-provider-deployments/${encodeURIComponent(customProviderDeploymentId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersDeploymentsGetOutput
    );
  }

  /**
   * @name Get custom provider deployment logs
   * @description Retrieves the build and deployment logs for a custom provider deployment.
   *
   * @param `customProviderDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersDeploymentsGetLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getLogs(
    customProviderDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersDeploymentsGetLogsOutput> {
    let path = `custom-provider-deployments/${encodeURIComponent(customProviderDeploymentId)}/logs`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersDeploymentsGetLogsOutput
    );
  }
}
