import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomProvidersCommitsCreateBody,
  mapDashboardInstanceCustomProvidersCommitsCreateOutput,
  mapDashboardInstanceCustomProvidersCommitsGetOutput,
  mapDashboardInstanceCustomProvidersCommitsListOutput,
  mapDashboardInstanceCustomProvidersCommitsListQuery,
  type DashboardInstanceCustomProvidersCommitsCreateBody,
  type DashboardInstanceCustomProvidersCommitsCreateOutput,
  type DashboardInstanceCustomProvidersCommitsGetOutput,
  type DashboardInstanceCustomProvidersCommitsListOutput,
  type DashboardInstanceCustomProvidersCommitsListQuery
} from '../resources';

/**
 * @name Custom Provider Commits controller
 * @description Commits represent version promotions between environments. Merge versions from one environment to another or rollback to a previous version.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceCustomProvidersCommitsEndpoint {
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
   * @name List custom provider commits
   * @description Returns a paginated list of commits for a custom provider.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `query` - DashboardInstanceCustomProvidersCommitsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersCommitsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    customProviderId: string,
    query?: DashboardInstanceCustomProvidersCommitsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersCommitsListOutput> {
    let path = `dashboard/instances/${instanceId}/custom-providers/${customProviderId}/commits`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCustomProvidersCommitsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceCustomProvidersCommitsListOutput);
  }

  /**
   * @name Get custom provider commit
   * @description Retrieves a specific commit.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `customProviderCommitId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersCommitsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    customProviderId: string,
    customProviderCommitId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersCommitsGetOutput> {
    let path = `dashboard/instances/${instanceId}/custom-providers/${customProviderId}/commits/${customProviderCommitId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceCustomProvidersCommitsGetOutput);
  }

  /**
   * @name Create custom provider commit
   * @description Creates a new commit to promote or rollback a version in an environment.
   *
   * @param `instanceId` - string
   * @param `customProviderId` - string
   * @param `body` - DashboardInstanceCustomProvidersCommitsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomProvidersCommitsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    customProviderId: string,
    body: DashboardInstanceCustomProvidersCommitsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomProvidersCommitsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/custom-providers/${customProviderId}/commits`;

    let request = {
      path,
      body: mapDashboardInstanceCustomProvidersCommitsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceCustomProvidersCommitsCreateOutput
    );
  }
}
