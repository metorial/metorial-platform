import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceInstanceGetOutput,
  mapDashboardInstanceInstancesListOutput,
  type DashboardInstanceInstanceGetOutput,
  type DashboardInstanceInstancesListOutput
} from '../resources';

/**
 * @name Instance controller
 * @description An instance is an isolated environment within a Metorial project. Instances are created via the dashboard (since API keys are scoped to instances). Common setups include production, staging, and development instances.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialInstanceEndpoint {
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
   * @name Get instance details
   * @description Retrieves metadata and configuration details for a specific instance.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceInstanceGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<DashboardInstanceInstanceGetOutput> {
    let path = 'instance';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceInstanceGetOutput);
  }

  /**
   * @name List instances
   * @description Lists all instances within the organization that the authenticated actor has access to.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(opts?: {
    headers?: Record<string, string>;
  }): Promise<DashboardInstanceInstancesListOutput> {
    let path = 'instances';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceInstancesListOutput
    );
  }
}
