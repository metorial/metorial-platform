import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthTokenExportsCreateBody,
  mapDashboardInstanceProviderOauthTokenExportsCreateOutput,
  mapDashboardInstanceProviderOauthTokenExportsGetOutput,
  mapDashboardInstanceProviderOauthTokenExportsListOutput,
  mapDashboardInstanceProviderOauthTokenExportsListQuery,
  type DashboardInstanceProviderOauthTokenExportsCreateBody,
  type DashboardInstanceProviderOauthTokenExportsCreateOutput,
  type DashboardInstanceProviderOauthTokenExportsGetOutput,
  type DashboardInstanceProviderOauthTokenExportsListOutput,
  type DashboardInstanceProviderOauthTokenExportsListQuery
} from '../resources';

/**
 * @name OAuth Token Export controller
 * @description Manage provider OAuth token export information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderOauthTokenExportsEndpoint {
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
   * @name List provider OAuth token exports
   * @description List all provider OAuth token exports
   *
   * @param `query` - DashboardInstanceProviderOauthTokenExportsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTokenExportsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderOauthTokenExportsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTokenExportsListOutput> {
    let path = 'provider-oauth/token-exports';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthTokenExportsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthTokenExportsListOutput
    );
  }

  /**
   * @name Create provider OAuth token export
   * @description Create a new provider OAuth token export
   *
   * @param `body` - DashboardInstanceProviderOauthTokenExportsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTokenExportsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProviderOauthTokenExportsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTokenExportsCreateOutput> {
    let path = 'provider-oauth/token-exports';

    let request = {
      path,
      body: mapDashboardInstanceProviderOauthTokenExportsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderOauthTokenExportsCreateOutput
    );
  }

  /**
   * @name Get provider OAuth token export
   * @description Get information for a specific provider OAuth token export
   *
   * @param `takeoutId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTokenExportsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    takeoutId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTokenExportsGetOutput> {
    let path = `provider-oauth/token-exports/${takeoutId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthTokenExportsGetOutput
    );
  }
}
