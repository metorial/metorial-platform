import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthSessionsCreateBody,
  mapDashboardInstanceProviderOauthSessionsCreateOutput,
  mapDashboardInstanceProviderOauthSessionsDeleteOutput,
  mapDashboardInstanceProviderOauthSessionsGetOutput,
  mapDashboardInstanceProviderOauthSessionsListOutput,
  mapDashboardInstanceProviderOauthSessionsListQuery,
  type DashboardInstanceProviderOauthSessionsCreateBody,
  type DashboardInstanceProviderOauthSessionsCreateOutput,
  type DashboardInstanceProviderOauthSessionsDeleteOutput,
  type DashboardInstanceProviderOauthSessionsGetOutput,
  type DashboardInstanceProviderOauthSessionsListOutput,
  type DashboardInstanceProviderOauthSessionsListQuery
} from '../resources';

/**
 * @name OAuth Session controller
 * @description Manage provider OAuth session information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderOauthSessionsEndpoint {
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
   * @name List provider OAuth sessions
   * @description List all provider OAuth sessions
   *
   * @param `query` - DashboardInstanceProviderOauthSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderOauthSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthSessionsListOutput> {
    let path = 'provider-oauth/sessions';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthSessionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthSessionsListOutput
    );
  }

  /**
   * @name Create provider OAuth session
   * @description Create a new provider OAuth session
   *
   * @param `body` - DashboardInstanceProviderOauthSessionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthSessionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProviderOauthSessionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthSessionsCreateOutput> {
    let path = 'provider-oauth/sessions';

    let request = {
      path,
      body: mapDashboardInstanceProviderOauthSessionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderOauthSessionsCreateOutput
    );
  }

  /**
   * @name Get provider OAuth session
   * @description Get information for a specific provider OAuth session
   *
   * @param `oauthSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    oauthSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthSessionsGetOutput> {
    let path = `provider-oauth/sessions/${oauthSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthSessionsGetOutput
    );
  }

  /**
   * @name Delete provider OAuth session
   * @description Delete a provider OAuth session
   *
   * @param `oauthSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthSessionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    oauthSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthSessionsDeleteOutput> {
    let path = `provider-oauth/sessions/${oauthSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderOauthSessionsDeleteOutput
    );
  }
}
