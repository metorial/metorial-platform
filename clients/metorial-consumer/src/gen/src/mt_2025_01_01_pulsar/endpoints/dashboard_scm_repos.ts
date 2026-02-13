import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardScmReposCreateBody,
  mapDashboardScmReposCreateOutput,
  mapDashboardScmReposPreviewOutput,
  mapDashboardScmReposPreviewQuery,
  type DashboardScmReposCreateBody,
  type DashboardScmReposCreateOutput,
  type DashboardScmReposPreviewOutput,
  type DashboardScmReposPreviewQuery
} from '../resources';

/**
 * @name SCM Repo controller
 * @description Read and write SCM repository information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardScmReposEndpoint {
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
   * @name Link SCM Repository
   * @description Link an SCM repository to the organization
   *
   * @param `organizationId` - string
   * @param `body` - DashboardScmReposCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardScmReposCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardScmReposCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardScmReposCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/scm/repos`;

    let request = {
      path,
      body: mapDashboardScmReposCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardScmReposCreateOutput);
  }

  /**
   * @name List SCM Repositories
   * @description List SCM repositories for all organizations the user is a member of
   *
   * @param `organizationId` - string
   * @param `query` - DashboardScmReposPreviewQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardScmReposPreviewOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  preview(
    organizationId: string,
    query?: DashboardScmReposPreviewQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardScmReposPreviewOutput> {
    let path = `dashboard/organizations/${organizationId}/scm/repos/preview`;

    let request = {
      path,

      query: query
        ? mapDashboardScmReposPreviewQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardScmReposPreviewOutput);
  }
}
