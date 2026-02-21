import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceScmInstallationCreateBody,
  mapDashboardInstanceScmInstallationCreateOutput,
  mapDashboardInstanceScmInstallationListOutput,
  mapDashboardInstanceScmInstallationListQuery,
  type DashboardInstanceScmInstallationCreateBody,
  type DashboardInstanceScmInstallationCreateOutput,
  type DashboardInstanceScmInstallationListOutput,
  type DashboardInstanceScmInstallationListQuery
} from '../resources';

/**
 * @name SCM Installations controller
 * @description Manage source control management installations (e.g. GitHub App installations).
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceScmInstallationEndpoint {
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
   * @name List SCM installations
   * @description Returns a paginated list of SCM installations.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceScmInstallationListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmInstallationListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceScmInstallationListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmInstallationListOutput> {
    let path = `instances/${instanceId}/scm/installations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceScmInstallationListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceScmInstallationListOutput
    );
  }

  /**
   * @name Create SCM installation
   * @description Initiates an SCM installation setup (e.g. GitHub App authorization).
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceScmInstallationCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmInstallationCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceScmInstallationCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmInstallationCreateOutput> {
    let path = `instances/${instanceId}/scm/installations`;

    let request = {
      path,
      body: mapDashboardInstanceScmInstallationCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceScmInstallationCreateOutput
    );
  }
}
