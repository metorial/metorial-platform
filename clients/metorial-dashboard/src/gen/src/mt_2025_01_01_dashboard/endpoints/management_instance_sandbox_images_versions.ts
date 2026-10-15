import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxImagesVersionsGetOutput,
  mapDashboardInstanceSandboxImagesVersionsListOutput,
  mapDashboardInstanceSandboxImagesVersionsListQuery,
  type DashboardInstanceSandboxImagesVersionsGetOutput,
  type DashboardInstanceSandboxImagesVersionsListOutput,
  type DashboardInstanceSandboxImagesVersionsListQuery
} from '../resources';

/**
 * @name Sandbox images controller
 * @description Images machines boot from. Metorial provides global images, and you can build your own from a Dockerfile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxImagesVersionsEndpoint {
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
   * @name List image versions
   * @description Returns a paginated list of the versions of an image.
   *
   * @param `instanceId` - string
   * @param `imageId` - string
   * @param `query` - DashboardInstanceSandboxImagesVersionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesVersionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    imageId: string,
    query?: DashboardInstanceSandboxImagesVersionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesVersionsListOutput> {
    let path = `instances/${instanceId}/sandbox/images/${imageId}/versions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxImagesVersionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImagesVersionsListOutput
    );
  }

  /**
   * @name Get image version
   * @description Retrieves a version of an image.
   *
   * @param `instanceId` - string
   * @param `imageId` - string
   * @param `versionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImagesVersionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    imageId: string,
    versionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImagesVersionsGetOutput> {
    let path = `instances/${instanceId}/sandbox/images/${imageId}/versions/${versionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImagesVersionsGetOutput
    );
  }
}
