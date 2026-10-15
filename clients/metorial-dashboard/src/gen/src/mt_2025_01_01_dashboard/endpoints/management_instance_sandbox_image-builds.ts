import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSandboxImageBuildsCancelOutput,
  mapDashboardInstanceSandboxImageBuildsGetOutput,
  mapDashboardInstanceSandboxImageBuildsListOutput,
  mapDashboardInstanceSandboxImageBuildsListQuery,
  mapDashboardInstanceSandboxImageBuildsLogsOutput,
  mapDashboardInstanceSandboxImageBuildsLogsQuery,
  type DashboardInstanceSandboxImageBuildsCancelOutput,
  type DashboardInstanceSandboxImageBuildsGetOutput,
  type DashboardInstanceSandboxImageBuildsListOutput,
  type DashboardInstanceSandboxImageBuildsListQuery,
  type DashboardInstanceSandboxImageBuildsLogsOutput,
  type DashboardInstanceSandboxImageBuildsLogsQuery
} from '../resources';

/**
 * @name Sandbox image builds controller
 * @description Builds turn a Dockerfile and its context into an image version and replicate it to every region.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSandboxImageBuildsEndpoint {
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
   * @description Returns a paginated list of image builds across all images.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSandboxImageBuildsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImageBuildsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSandboxImageBuildsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImageBuildsListOutput> {
    let path = `instances/${instanceId}/sandbox/image-builds`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxImageBuildsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImageBuildsListOutput
    );
  }

  /**
   * @name Get image build
   * @description Retrieves an image build by ID.
   *
   * @param `instanceId` - string
   * @param `buildId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImageBuildsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    buildId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImageBuildsGetOutput> {
    let path = `instances/${instanceId}/sandbox/image-builds/${buildId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImageBuildsGetOutput
    );
  }

  /**
   * @name Cancel image build
   * @description Cancels a build that is still running.
   *
   * @param `instanceId` - string
   * @param `buildId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImageBuildsCancelOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  cancel(
    instanceId: string,
    buildId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImageBuildsCancelOutput> {
    let path = `instances/${instanceId}/sandbox/image-builds/${buildId}/cancel`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSandboxImageBuildsCancelOutput
    );
  }

  /**
   * @name Get image build logs
   * @description Returns a page of the build output.
   *
   * @param `instanceId` - string
   * @param `buildId` - string
   * @param `query` - DashboardInstanceSandboxImageBuildsLogsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSandboxImageBuildsLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  logs(
    instanceId: string,
    buildId: string,
    query?: DashboardInstanceSandboxImageBuildsLogsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSandboxImageBuildsLogsOutput> {
    let path = `instances/${instanceId}/sandbox/image-builds/${buildId}/logs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSandboxImageBuildsLogsQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSandboxImageBuildsLogsOutput
    );
  }
}
