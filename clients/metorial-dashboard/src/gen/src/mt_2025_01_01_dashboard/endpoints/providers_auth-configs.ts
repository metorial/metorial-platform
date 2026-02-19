import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersAuthConfigsListOutput,
  mapDashboardInstanceProvidersAuthConfigsListQuery,
  type DashboardInstanceProvidersAuthConfigsListOutput,
  type DashboardInstanceProvidersAuthConfigsListQuery
} from '../resources';

/**
 * @name Provider Auth Configs (Provider-scoped) controller
 * @description List auth configs scoped to a provider, optionally filtered by deployment.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProvidersAuthConfigsEndpoint {
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
   * @name List provider auth configs
   * @description Returns a paginated list of auth configs, optionally filtered by provider and deployment IDs.
   *
   * @param `query` - DashboardInstanceProvidersAuthConfigsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersAuthConfigsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProvidersAuthConfigsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersAuthConfigsListOutput> {
    let path = 'providers/auth-configs';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersAuthConfigsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceProvidersAuthConfigsListOutput);
  }
}
