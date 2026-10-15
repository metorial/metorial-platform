import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxDisksCloneBody,
  mapDashboardInstanceSandboxDisksCloneOutput,
  mapDashboardInstanceSandboxDisksCreateBody,
  mapDashboardInstanceSandboxDisksCreateOutput,
  mapDashboardInstanceSandboxDisksDeleteOutput,
  mapDashboardInstanceSandboxDisksGetOutput,
  mapDashboardInstanceSandboxDisksListOutput,
  mapDashboardInstanceSandboxDisksListQuery,
  mapDashboardInstanceSandboxDisksResizeBody,
  mapDashboardInstanceSandboxDisksResizeOutput,
  mapDashboardInstanceSandboxDisksUpdateBody,
  mapDashboardInstanceSandboxDisksUpdateOutput,
  type DashboardInstanceSandboxDisksCloneBody,
  type DashboardInstanceSandboxDisksCloneOutput,
  type DashboardInstanceSandboxDisksCreateBody,
  type DashboardInstanceSandboxDisksCreateOutput,
  type DashboardInstanceSandboxDisksDeleteOutput,
  type DashboardInstanceSandboxDisksGetOutput,
  type DashboardInstanceSandboxDisksListOutput,
  type DashboardInstanceSandboxDisksListQuery,
  type DashboardInstanceSandboxDisksResizeBody,
  type DashboardInstanceSandboxDisksResizeOutput,
  type DashboardInstanceSandboxDisksUpdateBody,
  type DashboardInstanceSandboxDisksUpdateOutput
} from '../resources';

/**
 * @name Sandbox disks controller
 * @description Persistent disks that can be mounted into machines. Every machine also has a root filesystem disk that is managed for it.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxDisksEndpoint {
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
   * @name List sandbox disks
   * @description Returns a paginated list of disks.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSandboxDisksListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSandboxDisksListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksListOutput> {
    let path = `instances/${instanceId}/sandbox/disks`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxDisksListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxDisksListOutput
    );
  }

  /**
   * @name Get sandbox disk
   * @description Retrieves a disk by ID.
   *
   * @param `instanceId` - string
   * @param `diskId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    diskId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksGetOutput> {
    let path = `instances/${instanceId}/sandbox/disks/${diskId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxDisksGetOutput
    );
  }

  /**
   * @name Create sandbox disk
   * @description Creates an empty disk.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSandboxDisksCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSandboxDisksCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksCreateOutput> {
    let path = `instances/${instanceId}/sandbox/disks`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxDisksCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxDisksCreateOutput
    );
  }

  /**
   * @name Update sandbox disk
   * @description Updates a disk name and metadata. Only metadata can be updated for root filesystem disks.
   *
   * @param `instanceId` - string
   * @param `diskId` - string
   * @param `body` - DashboardInstanceSandboxDisksUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    diskId: string,
    body: DashboardInstanceSandboxDisksUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksUpdateOutput> {
    let path = `instances/${instanceId}/sandbox/disks/${diskId}`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxDisksUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSandboxDisksUpdateOutput
    );
  }

  /**
   * @name Delete sandbox disk
   * @description Deletes a disk. Root filesystem disks cannot be deleted; they are removed with their machine.
   *
   * @param `instanceId` - string
   * @param `diskId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    diskId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksDeleteOutput> {
    let path = `instances/${instanceId}/sandbox/disks/${diskId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSandboxDisksDeleteOutput
    );
  }

  /**
   * @name Clone sandbox disk
   * @description Creates a copy of a disk in the same region.
   *
   * @param `instanceId` - string
   * @param `diskId` - string
   * @param `body` - DashboardInstanceSandboxDisksCloneBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksCloneOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  clone(
    instanceId: string,
    diskId: string,
    body: DashboardInstanceSandboxDisksCloneBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksCloneOutput> {
    let path = `instances/${instanceId}/sandbox/disks/${diskId}/clone`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxDisksCloneBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxDisksCloneOutput
    );
  }

  /**
   * @name Resize sandbox disk
   * @description Starts growing a disk to a larger size.
   *
   * @param `instanceId` - string
   * @param `diskId` - string
   * @param `body` - DashboardInstanceSandboxDisksResizeBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxDisksResizeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  resize(
    instanceId: string,
    diskId: string,
    body: DashboardInstanceSandboxDisksResizeBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxDisksResizeOutput> {
    let path = `instances/${instanceId}/sandbox/disks/${diskId}/resize`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxDisksResizeBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxDisksResizeOutput
    );
  }
}
