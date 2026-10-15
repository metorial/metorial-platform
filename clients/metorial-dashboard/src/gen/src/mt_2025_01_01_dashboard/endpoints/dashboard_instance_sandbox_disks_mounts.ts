import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxDisksMountsListOutput,
  mapDashboardInstanceSandboxDisksMountsListQuery,
  type DashboardInstanceSandboxDisksMountsListOutput,
  type DashboardInstanceSandboxDisksMountsListQuery
} from '../resources';

/**
 * @name Sandbox disks controller
 * @description Persistent disks that can be mounted into machines. Every machine also has a root filesystem disk that is managed for it.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSandboxDisksMountsEndpoint {
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
   * @name List disk mounts
   * @description Returns a paginated list of the times a disk was mounted into a machine.
   *
   * @param `instanceId` - string
   * @param `diskId` - string
   * @param `query` - DashboardInstanceSandboxDisksMountsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksMountsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    diskId: string,
    query?: DashboardInstanceSandboxDisksMountsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksMountsListOutput> {
    let path = `dashboard/instances/${instanceId}/sandbox/disks/${diskId}/mounts`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxDisksMountsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxDisksMountsListOutput
    );
  }
}
