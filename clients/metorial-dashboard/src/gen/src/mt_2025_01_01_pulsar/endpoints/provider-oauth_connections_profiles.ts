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
export class MetorialProviderOauthConnectionsProfilesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List provider OAuth connection profiles
   * @description List provider OAuth connection profiles for a specific connection
   *
   * @param `connectionId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsProfilesListQuery
   *
   * @returns DashboardInstanceProviderOauthConnectionsProfilesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    connectionId: string,
    query?: DashboardInstanceProviderOauthConnectionsProfilesListQuery
  ): Promise<DashboardInstanceProviderOauthConnectionsProfilesListOutput> {
    let path = `provider-oauth/connections/${connectionId}/profiles`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsProfilesListQuery.transformTo(
            query
          )
        : undefined
    }).transform(
      mapDashboardInstanceProviderOauthConnectionsProfilesListOutput
    );
  }

  /**
   * @name Get provider OAuth connection profile
   * @description Get the information of a specific provider OAuth connection profile
   *
   * @param `connectionId` - string
   * @param `profileId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsProfilesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    connectionId: string,
    profileId: string
  ): Promise<DashboardInstanceProviderOauthConnectionsProfilesGetOutput> {
    let path = `provider-oauth/connections/${connectionId}/profiles/${profileId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceProviderOauthConnectionsProfilesGetOutput);
  }
}
