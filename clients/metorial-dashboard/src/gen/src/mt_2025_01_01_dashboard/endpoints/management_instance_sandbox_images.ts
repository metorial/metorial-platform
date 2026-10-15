import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxImagesCreateBody,
  mapDashboardInstanceSandboxImagesCreateOutput,
  mapDashboardInstanceSandboxImagesDeleteOutput,
  mapDashboardInstanceSandboxImagesGetOutput,
  mapDashboardInstanceSandboxImagesListOutput,
  mapDashboardInstanceSandboxImagesListQuery,
  mapDashboardInstanceSandboxImagesUpdateBody,
  mapDashboardInstanceSandboxImagesUpdateOutput,
  type DashboardInstanceSandboxImagesCreateBody,
  type DashboardInstanceSandboxImagesCreateOutput,
  type DashboardInstanceSandboxImagesDeleteOutput,
  type DashboardInstanceSandboxImagesGetOutput,
  type DashboardInstanceSandboxImagesListOutput,
  type DashboardInstanceSandboxImagesListQuery,
  type DashboardInstanceSandboxImagesUpdateBody,
  type DashboardInstanceSandboxImagesUpdateOutput
} from '../resources';

/**
 * @name Sandbox images controller
 * @description Images machines boot from. Metorial provides global images, and you can build your own from a Dockerfile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxImagesEndpoint {
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
   * @name List sandbox images
   * @description Returns a paginated list of the images you can create machines from.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSandboxImagesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSandboxImagesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesListOutput> {
    let path = `instances/${instanceId}/sandbox/images`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxImagesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImagesListOutput
    );
  }

  /**
   * @name Get sandbox image
   * @description Retrieves an image by ID.
   *
   * @param `instanceId` - string
   * @param `imageId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    imageId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesGetOutput> {
    let path = `instances/${instanceId}/sandbox/images/${imageId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImagesGetOutput
    );
  }

  /**
   * @name Create sandbox image
   * @description Creates an empty image. Build a version of it to make it available to machines.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSandboxImagesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSandboxImagesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesCreateOutput> {
    let path = `instances/${instanceId}/sandbox/images`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxImagesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxImagesCreateOutput
    );
  }

  /**
   * @name Update sandbox image
   * @description Updates the name and metadata of one of your images.
   *
   * @param `instanceId` - string
   * @param `imageId` - string
   * @param `body` - DashboardInstanceSandboxImagesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    imageId: string,
    body: DashboardInstanceSandboxImagesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesUpdateOutput> {
    let path = `instances/${instanceId}/sandbox/images/${imageId}`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxImagesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSandboxImagesUpdateOutput
    );
  }

  /**
   * @name Delete sandbox image
   * @description Deletes one of your images and cancels its running builds.
   *
   * @param `instanceId` - string
   * @param `imageId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    imageId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesDeleteOutput> {
    let path = `instances/${instanceId}/sandbox/images/${imageId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSandboxImagesDeleteOutput
    );
  }
}
