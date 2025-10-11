import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardScmInstallationsCreateBody,
  mapDashboardScmInstallationsCreateOutput,
  mapDashboardScmInstallationsGetOutput,
  mapDashboardScmInstallationsListOutput,
  mapDashboardScmInstallationsListQuery,
  type DashboardScmInstallationsCreateBody,
  type DashboardScmInstallationsCreateOutput,
  type DashboardScmInstallationsGetOutput,
  type DashboardScmInstallationsListOutput,
  type DashboardScmInstallationsListQuery
} from '../resources';

/**
 * @name SCM Repo controller
 * @description Read and write SCM repository information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardScmInstallationsEndpoint {
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
   * @name List SCM Installations
   * @description List SCM installations for the organization
   *
   * @param `organizationId` - string
   * @param `query` - DashboardScmInstallationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardScmInstallationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardScmInstallationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardScmInstallationsListOutput> {
    let path = `dashboard/organizations/${organizationId}/scm/installations`;

    let request = {
      path,

      query: query
        ? mapDashboardScmInstallationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardScmInstallationsListOutput);
  }

  /**
   * @name Get SCM Installation
   * @description Get a single SCM installation for the organization
   *
   * @param `organizationId` - string
   * @param `installationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardScmInstallationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    installationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardScmInstallationsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/scm/installations/${installationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardScmInstallationsGetOutput);
  }

  /**
   * @name Install SCM Integration
   * @description Install an SCM integration for the organization
   *
   * @param `organizationId` - string
   * @param `body` - DashboardScmInstallationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardScmInstallationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardScmInstallationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardScmInstallationsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/scm/installations`;

    let request = {
      path,
      body: mapDashboardScmInstallationsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardScmInstallationsCreateOutput
    );
  }
}
