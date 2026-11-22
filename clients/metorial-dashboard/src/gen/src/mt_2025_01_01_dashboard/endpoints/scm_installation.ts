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
 * @description An SCM installation is a provider app installation connected to an instance, for example a GitHub App installation.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialScmInstallationEndpoint {
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
   * @param `query` - DashboardInstanceScmInstallationListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmInstallationListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceScmInstallationListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmInstallationListOutput> {
    let path = 'scm/installations';

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
   * @description Creates an installation setup session. Open the returned URL to authorize access.
   *
   * @param `body` - DashboardInstanceScmInstallationCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmInstallationCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceScmInstallationCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmInstallationCreateOutput> {
    let path = 'scm/installations';

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
