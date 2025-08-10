import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderOauthConnectionsProfilesGetOutput,
  mapDashboardInstanceProviderOauthConnectionsProfilesListOutput,
  mapDashboardInstanceProviderOauthConnectionsProfilesListQuery,
  type DashboardInstanceProviderOauthConnectionsProfilesGetOutput,
  type DashboardInstanceProviderOauthConnectionsProfilesListOutput,
  type DashboardInstanceProviderOauthConnectionsProfilesListQuery
} from '../resources';

/**
 * @name OAuth Profile controller
 * @description Manage provider OAuth connection profile information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderOauthConnectionsProfilesEndpoint {
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
   * @name List provider OAuth connection profiles
   * @description List provider OAuth connection profiles for a specific connection
   *
   * @param `connectionId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsProfilesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsProfilesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    connectionId: string,
    query?: DashboardInstanceProviderOauthConnectionsProfilesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsProfilesListOutput> {
    let path = `provider-oauth/connections/${connectionId}/profiles`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsProfilesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsProfilesListOutput
    );
  }

  /**
   * @name Get provider OAuth connection profile
   * @description Get the information of a specific provider OAuth connection profile
   *
   * @param `connectionId` - string
   * @param `profileId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderOauthConnectionsProfilesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    connectionId: string,
    profileId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderOauthConnectionsProfilesGetOutput> {
    let path = `provider-oauth/connections/${connectionId}/profiles/${profileId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderOauthConnectionsProfilesGetOutput
    );
  }
}
