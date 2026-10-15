import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxDisksResizesGetOutput,
  mapDashboardInstanceSandboxDisksResizesListOutput,
  mapDashboardInstanceSandboxDisksResizesListQuery,
  mapDashboardInstanceSandboxDisksResizesRetryOutput,
  type DashboardInstanceSandboxDisksResizesGetOutput,
  type DashboardInstanceSandboxDisksResizesListOutput,
  type DashboardInstanceSandboxDisksResizesListQuery,
  type DashboardInstanceSandboxDisksResizesRetryOutput
} from '../resources';

/**
 * @name Sandbox disk resizes controller
 * @description Resizing a disk briefly stops the machines it is mounted into. Each resize is tracked until it completes.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSandboxDisksResizesEndpoint {
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
   * @name List disk resizes
   * @description Returns a paginated list of the resizes of a disk.
   *
   * @param `diskId` - string
   * @param `query` - DashboardInstanceSandboxDisksResizesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksResizesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    diskId: string,
    query?: DashboardInstanceSandboxDisksResizesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksResizesListOutput> {
    let path = `sandbox/disks/${diskId}/resizes`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxDisksResizesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxDisksResizesListOutput
    );
  }

  /**
   * @name Get disk resize
   * @description Retrieves a resize of a disk.
   *
   * @param `diskId` - string
   * @param `resizeId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksResizesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    diskId: string,
    resizeId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksResizesGetOutput> {
    let path = `sandbox/disks/${diskId}/resizes/${resizeId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxDisksResizesGetOutput
    );
  }

  /**
   * @name Retry disk resize
   * @description Retries a resize that failed.
   *
   * @param `diskId` - string
   * @param `resizeId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksResizesRetryOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  retry(
    diskId: string,
    resizeId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksResizesRetryOutput> {
    let path = `sandbox/disks/${diskId}/resizes/${resizeId}/retry`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxDisksResizesRetryOutput
    );
  }
}
