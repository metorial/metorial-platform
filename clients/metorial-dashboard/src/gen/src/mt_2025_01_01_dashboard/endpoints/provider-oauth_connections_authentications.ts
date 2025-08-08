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
export class MetorialProviderOauthConnectionsAuthenticationsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List provider OAuth connection authentications
   * @description List provider OAuth connection authentications for a specific connection
   *
   * @param `connectionId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
   *
   * @returns DashboardInstanceProviderOauthConnectionsAuthenticationsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    connectionId: string,
    query?: DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
  ): Promise<DashboardInstanceProviderOauthConnectionsAuthenticationsListOutput> {
    let path = `provider-oauth/connections/${connectionId}/authentications`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsAuthenticationsListQuery.transformTo(
            query
          )
        : undefined
    }).transform(
      mapDashboardInstanceProviderOauthConnectionsAuthenticationsListOutput
    );
  }

  /**
   * @name Get provider OAuth connection authentication
   * @description Get the information of a specific provider OAuth connection authentication
   *
   * @param `connectionId` - string
   * @param `authenticationId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    connectionId: string,
    authenticationId: string
  ): Promise<DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput> {
    let path = `provider-oauth/connections/${connectionId}/authentications/${authenticationId}`;
    return this._get({
      path
    }).transform(
      mapDashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput
    );
  }
}
