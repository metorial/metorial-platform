import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersAuthCredentialsListOutput,
  mapDashboardInstanceProvidersAuthCredentialsListQuery,
  type DashboardInstanceProvidersAuthCredentialsListOutput,
  type DashboardInstanceProvidersAuthCredentialsListQuery
} from '../resources';

/**
 * @name Provider Auth Credentials (Instance-scoped) controller
 * @description List auth credentials scoped to the instance, optionally filtered by provider.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProvidersAuthCredentialsEndpoint {
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
   * @name List provider auth credentials
   * @description Returns a paginated list of auth credentials, optionally filtered by provider ID(s).
   *
   * @param `query` - DashboardInstanceProvidersAuthCredentialsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersAuthCredentialsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProvidersAuthCredentialsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersAuthCredentialsListOutput> {
    let path = 'providers/auth-credentials';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersAuthCredentialsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersAuthCredentialsListOutput
    );
  }
}
