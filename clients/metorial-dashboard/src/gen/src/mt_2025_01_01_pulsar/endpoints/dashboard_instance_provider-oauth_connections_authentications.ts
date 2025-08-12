import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput,
  mapDashboardInstanceProviderOauthConnectionsAuthenticationsListOutput,
  mapDashboardInstanceProviderOauthConnectionsAuthenticationsListQuery,
  type DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput,
  type DashboardInstanceProviderOauthConnectionsAuthenticationsListOutput,
  type DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
} from '../resources';

/**
 * @name OAuth Authentication controller
 * @description Manage provider OAuth connection authentication information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderOauthConnectionsAuthenticationsEndpoint {
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
   * @name List provider OAuth connection authentications
   * @description List provider OAuth connection authentications for a specific connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsAuthenticationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    connectionId: string,
    query?: DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsAuthenticationsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-oauth/connections/${connectionId}/authentications`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsAuthenticationsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsAuthenticationsListOutput
    );
  }

  /**
   * @name Get provider OAuth connection authentication
   * @description Get the information of a specific provider OAuth connection authentication
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `authenticationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    connectionId: string,
    authenticationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-oauth/connections/${connectionId}/authentications/${authenticationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput
    );
  }
}
