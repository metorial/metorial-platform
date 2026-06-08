import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardProjectsKeyProvidersErrorsListOutput,
  mapDashboardProjectsKeyProvidersErrorsListQuery,
  type DashboardProjectsKeyProvidersErrorsListOutput,
  type DashboardProjectsKeyProvidersErrorsListQuery
} from '../resources';

/**
 * @name Key providers controller
 * @description Manage project encryption key providers and diagnostics
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardProjectsKeyProvidersErrorsEndpoint {
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
   * @name List key provider errors
   * @description Returns aggregated key provider errors for diagnostics
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `keyProviderId` - string
   * @param `query` - DashboardProjectsKeyProvidersErrorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardProjectsKeyProvidersErrorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    projectId: string,
    keyProviderId: string,
    query?: DashboardProjectsKeyProvidersErrorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardProjectsKeyProvidersErrorsListOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}/key-providers/${keyProviderId}/errors`;

    let request = {
      path,

      query: query
        ? mapDashboardProjectsKeyProvidersErrorsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardProjectsKeyProvidersErrorsListOutput
    );
  }
}
