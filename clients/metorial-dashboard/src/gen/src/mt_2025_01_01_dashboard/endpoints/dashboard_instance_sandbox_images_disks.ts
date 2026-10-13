import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxImagesDisksCreateBody,
  mapDashboardInstanceSandboxImagesDisksCreateOutput,
  type DashboardInstanceSandboxImagesDisksCreateBody,
  type DashboardInstanceSandboxImagesDisksCreateOutput
} from '../resources';

/**
 * @name Sandbox images controller
 * @description Images machines boot from. Metorial provides global images, and you can build your own from a Dockerfile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSandboxImagesDisksEndpoint {
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
   * @name Create disk from image
   * @description Creates a disk holding the contents of an image version.
   *
   * @param `instanceId` - string
   * @param `imageId` - string
   * @param `body` - DashboardInstanceSandboxImagesDisksCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesDisksCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    imageId: string,
    body: DashboardInstanceSandboxImagesDisksCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesDisksCreateOutput> {
    let path = `dashboard/instances/${instanceId}/sandbox/images/${imageId}/disks`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxImagesDisksCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxImagesDisksCreateOutput
    );
  }
}
