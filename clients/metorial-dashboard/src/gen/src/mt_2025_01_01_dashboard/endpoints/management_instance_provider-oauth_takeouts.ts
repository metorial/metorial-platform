import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthTakeoutsCreateBody,
  mapDashboardInstanceProviderOauthTakeoutsCreateOutput,
  mapDashboardInstanceProviderOauthTakeoutsGetOutput,
  mapDashboardInstanceProviderOauthTakeoutsListOutput,
  mapDashboardInstanceProviderOauthTakeoutsListQuery,
  type DashboardInstanceProviderOauthTakeoutsCreateBody,
  type DashboardInstanceProviderOauthTakeoutsCreateOutput,
  type DashboardInstanceProviderOauthTakeoutsGetOutput,
  type DashboardInstanceProviderOauthTakeoutsListOutput,
  type DashboardInstanceProviderOauthTakeoutsListQuery
} from '../resources';

/**
 * @name OAuth Takeout controller
 * @description Manage provider OAuth takeout information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderOauthTakeoutsEndpoint {
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
   * @name List provider OAuth takeouts
   * @description List all provider OAuth takeouts
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderOauthTakeoutsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTakeoutsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderOauthTakeoutsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTakeoutsListOutput> {
    let path = `instances/${instanceId}/provider-oauth/takeouts`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthTakeoutsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthTakeoutsListOutput
    );
  }

  /**
   * @name Create provider OAuth takeout
   * @description Create a new provider OAuth takeout
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderOauthTakeoutsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTakeoutsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderOauthTakeoutsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTakeoutsCreateOutput> {
    let path = `instances/${instanceId}/provider-oauth/takeouts`;

    let request = {
      path,
      body: mapDashboardInstanceProviderOauthTakeoutsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderOauthTakeoutsCreateOutput
    );
  }

  /**
   * @name Get provider OAuth takeout
   * @description Get information for a specific provider OAuth takeout
   *
   * @param `instanceId` - string
   * @param `takeoutId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTakeoutsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    takeoutId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTakeoutsGetOutput> {
    let path = `instances/${instanceId}/provider-oauth/takeouts/${takeoutId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthTakeoutsGetOutput
    );
  }
}
