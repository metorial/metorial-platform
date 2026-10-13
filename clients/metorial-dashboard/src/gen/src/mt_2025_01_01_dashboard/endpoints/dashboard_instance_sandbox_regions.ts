import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxRegionsGetOutput,
  mapDashboardInstanceSandboxRegionsListOutput,
  mapDashboardInstanceSandboxRegionsListQuery,
  type DashboardInstanceSandboxRegionsGetOutput,
  type DashboardInstanceSandboxRegionsListOutput,
  type DashboardInstanceSandboxRegionsListQuery
} from '../resources';

/**
 * @name Sandbox regions controller
 * @description Regions in which sandbox machines, disks, and images are available.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSandboxRegionsEndpoint {
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
   * @name List sandbox regions
   * @description Returns a paginated list of regions sandboxes can run in.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSandboxRegionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxRegionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSandboxRegionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxRegionsListOutput> {
    let path = `dashboard/instances/${instanceId}/sandbox/regions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxRegionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxRegionsListOutput
    );
  }

  /**
   * @name Get sandbox region
   * @description Retrieves a sandbox region by its identifier.
   *
   * @param `instanceId` - string
   * @param `regionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxRegionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    regionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxRegionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/sandbox/regions/${regionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxRegionsGetOutput
    );
  }
}
