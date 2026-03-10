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
 * @description Deployments track the build and deployment process of custom provider versions. View deployment status and logs.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint {
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
   * @description Returns a paginated list of deployments for a custom provider.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceCustomProvidersDeploymentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersDeploymentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceCustomProvidersDeploymentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersDeploymentsListOutput> {
    let path = `dashboard/instances/${instanceId}/custom-provider-deployments`;

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
   * @description Retrieves a specific deployment.
   *
   * @param `instanceId` - string
   * @param `customProviderDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersDeploymentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    customProviderDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersDeploymentsGetOutput> {
    let path = `dashboard/instances/${instanceId}/custom-provider-deployments/${customProviderDeploymentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersDeploymentsGetOutput
    );
  }

  /**
   * @name Get deployment logs
   * @description Retrieves the build and deployment logs for a deployment.
   *
   * @param `instanceId` - string
   * @param `customProviderDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersDeploymentsGetLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getLogs(
    instanceId: string,
    customProviderDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersDeploymentsGetLogsOutput> {
    let path = `dashboard/instances/${instanceId}/custom-provider-deployments/${customProviderDeploymentId}/logs`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomProvidersDeploymentsGetLogsOutput
    );
  }
}
