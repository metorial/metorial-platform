import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxImagesBuildsCreateBody,
  mapDashboardInstanceSandboxImagesBuildsCreateOutput,
  mapDashboardInstanceSandboxImagesBuildsListOutput,
  mapDashboardInstanceSandboxImagesBuildsListQuery,
  type DashboardInstanceSandboxImagesBuildsCreateBody,
  type DashboardInstanceSandboxImagesBuildsCreateOutput,
  type DashboardInstanceSandboxImagesBuildsListOutput,
  type DashboardInstanceSandboxImagesBuildsListQuery
} from '../resources';

/**
 * @name Sandbox images controller
 * @description Images machines boot from. Metorial provides global images, and you can build your own from a Dockerfile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSandboxImagesBuildsEndpoint {
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
   * @name List image builds
   * @description Returns a paginated list of the builds of an image.
   *
   * @param `imageId` - string
   * @param `query` - DashboardInstanceSandboxImagesBuildsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesBuildsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    imageId: string,
    query?: DashboardInstanceSandboxImagesBuildsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesBuildsListOutput> {
    let path = `sandbox/images/${imageId}/builds`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxImagesBuildsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImagesBuildsListOutput
    );
  }

  /**
   * @name Build image
   * @description Builds a new version of an image from a Dockerfile. Upload the build context as a file with the sandbox_image_build_context purpose first.
   *
   * @param `imageId` - string
   * @param `body` - DashboardInstanceSandboxImagesBuildsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesBuildsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    imageId: string,
    body: DashboardInstanceSandboxImagesBuildsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesBuildsCreateOutput> {
    let path = `sandbox/images/${imageId}/builds`;

    let request = {
      path,
      body: mapDashboardInstanceSandboxImagesBuildsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxImagesBuildsCreateOutput
    );
  }
}
