import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthTokenImportsCreateBody,
  mapDashboardInstanceProviderOauthTokenImportsCreateOutput,
  mapDashboardInstanceProviderOauthTokenImportsGetOutput,
  mapDashboardInstanceProviderOauthTokenImportsListOutput,
  mapDashboardInstanceProviderOauthTokenImportsListQuery,
  mapDashboardInstanceProviderOauthTokenImportsUpdateBody,
  mapDashboardInstanceProviderOauthTokenImportsUpdateOutput,
  type DashboardInstanceProviderOauthTokenImportsCreateBody,
  type DashboardInstanceProviderOauthTokenImportsCreateOutput,
  type DashboardInstanceProviderOauthTokenImportsGetOutput,
  type DashboardInstanceProviderOauthTokenImportsListOutput,
  type DashboardInstanceProviderOauthTokenImportsListQuery,
  type DashboardInstanceProviderOauthTokenImportsUpdateBody,
  type DashboardInstanceProviderOauthTokenImportsUpdateOutput
} from '../resources';

/**
 * @name OAuth Token Import controller
 * @description Manage provider OAuth import information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderOauthTokenImportsEndpoint {
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
   * @name List provider OAuth imports
   * @description List all provider OAuth imports
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderOauthTokenImportsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTokenImportsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderOauthTokenImportsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTokenImportsListOutput> {
    let path = `instances/${instanceId}/provider-oauth/token-imports`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthTokenImportsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthTokenImportsListOutput
    );
  }

  /**
   * @name Create provider OAuth import
   * @description Create a new provider OAuth import
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderOauthTokenImportsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTokenImportsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderOauthTokenImportsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTokenImportsCreateOutput> {
    let path = `instances/${instanceId}/provider-oauth/token-imports`;

    let request = {
      path,
      body: mapDashboardInstanceProviderOauthTokenImportsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderOauthTokenImportsCreateOutput
    );
  }

  /**
   * @name Get provider OAuth import
   * @description Get information for a specific provider OAuth import
   *
   * @param `instanceId` - string
   * @param `takeInId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTokenImportsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    takeInId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTokenImportsGetOutput> {
    let path = `instances/${instanceId}/provider-oauth/token-imports/${takeInId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthTokenImportsGetOutput
    );
  }

  /**
   * @name Update provider OAuth import
   * @description Update information for a specific provider OAuth import
   *
   * @param `instanceId` - string
   * @param `takeInId` - string
   * @param `body` - DashboardInstanceProviderOauthTokenImportsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthTokenImportsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    takeInId: string,
    body: DashboardInstanceProviderOauthTokenImportsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthTokenImportsUpdateOutput> {
    let path = `instances/${instanceId}/provider-oauth/token-imports/${takeInId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderOauthTokenImportsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderOauthTokenImportsUpdateOutput
    );
  }
}
