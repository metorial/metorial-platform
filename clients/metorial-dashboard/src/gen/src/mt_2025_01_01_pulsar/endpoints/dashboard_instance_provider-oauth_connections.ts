import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthConnectionsCreateBody,
  mapDashboardInstanceProviderOauthConnectionsCreateOutput,
  mapDashboardInstanceProviderOauthConnectionsDeleteOutput,
  mapDashboardInstanceProviderOauthConnectionsGetOutput,
  mapDashboardInstanceProviderOauthConnectionsListOutput,
  mapDashboardInstanceProviderOauthConnectionsListQuery,
  mapDashboardInstanceProviderOauthConnectionsUpdateBody,
  mapDashboardInstanceProviderOauthConnectionsUpdateOutput,
  type DashboardInstanceProviderOauthConnectionsCreateBody,
  type DashboardInstanceProviderOauthConnectionsCreateOutput,
  type DashboardInstanceProviderOauthConnectionsDeleteOutput,
  type DashboardInstanceProviderOauthConnectionsGetOutput,
  type DashboardInstanceProviderOauthConnectionsListOutput,
  type DashboardInstanceProviderOauthConnectionsListQuery,
  type DashboardInstanceProviderOauthConnectionsUpdateBody,
  type DashboardInstanceProviderOauthConnectionsUpdateOutput
} from '../resources';

/**
 * @name OAuth Connection controller
 * @description Manage provider OAuth connection information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderOauthConnectionsEndpoint {
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
   * @name List provider OAuth connections
   * @description List all provider OAuth connections
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderOauthConnectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-oauth/connections`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsListOutput
    );
  }

  /**
   * @name Create provider OAuth connection
   * @description Create a new provider OAuth connection
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderOauthConnectionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderOauthConnectionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-oauth/connections`;

    let request = {
      path,
      body: mapDashboardInstanceProviderOauthConnectionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProviderOauthConnectionsCreateOutput
    );
  }

  /**
   * @name Get provider OAuth connection
   * @description Get information for a specific provider OAuth connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    connectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-oauth/connections/${connectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsGetOutput
    );
  }

  /**
   * @name Update provider OAuth connection
   * @description Update a provider OAuth connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `body` - DashboardInstanceProviderOauthConnectionsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    connectionId: string,
    body: DashboardInstanceProviderOauthConnectionsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/provider-oauth/connections/${connectionId}`;

    let request = {
      path,
      body: mapDashboardInstanceProviderOauthConnectionsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceProviderOauthConnectionsUpdateOutput
    );
  }

  /**
   * @name Delete provider OAuth connection
   * @description Delete a provider OAuth connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    connectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/provider-oauth/connections/${connectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceProviderOauthConnectionsDeleteOutput
    );
  }
}
