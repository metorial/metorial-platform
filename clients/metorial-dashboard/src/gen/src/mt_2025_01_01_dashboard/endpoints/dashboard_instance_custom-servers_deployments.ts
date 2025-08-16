import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersDeploymentsGetOutput,
  mapDashboardInstanceCustomServersDeploymentsListOutput,
  mapDashboardInstanceCustomServersDeploymentsListQuery,
  type DashboardInstanceCustomServersDeploymentsGetOutput,
  type DashboardInstanceCustomServersDeploymentsListOutput,
  type DashboardInstanceCustomServersDeploymentsListQuery
} from '../resources';

/**
 * @name Custom Server controller
 * @description Manager custom server deployments
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCustomServersDeploymentsEndpoint {
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
   * @name List custom server deployments
   * @description List all custom server deployments
   *
   * @param `instanceId` - string
   * @param `customServerId` - string
   * @param `query` - DashboardInstanceCustomServersDeploymentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersDeploymentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    customServerId: string,
    query?: DashboardInstanceCustomServersDeploymentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersDeploymentsListOutput> {
    let path = `dashboard/instances/${instanceId}/custom-servers/${customServerId}/deployments`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomServersDeploymentsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersDeploymentsListOutput
    );
  }

  /**
   * @name Get custom server deployment
   * @description Get information for a specific custom server deployment
   *
   * @param `instanceId` - string
   * @param `customServerId` - string
   * @param `customServerDeploymentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersDeploymentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    customServerId: string,
    customServerDeploymentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersDeploymentsGetOutput> {
    let path = `dashboard/instances/${instanceId}/custom-servers/${customServerId}/deployments/${customServerDeploymentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersDeploymentsGetOutput
    );
  }
}
