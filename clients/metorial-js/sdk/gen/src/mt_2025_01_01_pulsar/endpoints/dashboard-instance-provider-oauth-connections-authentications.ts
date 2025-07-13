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
 * @name Provider OAuth Connection Authentication controller
 * @description Manage provider OAuth connection authentication information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderOauthConnectionsAuthenticationsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List provider OAuth connection authentications
   * @description List provider OAuth connection authentications for a specific connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
   *
   * @returns DashboardInstanceProviderOauthConnectionsAuthenticationsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    connectionId: string,
    query?: DashboardInstanceProviderOauthConnectionsAuthenticationsListQuery
  ) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'provider-oauth',
        'connections',
        connectionId,
        'authentications'
      ],

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
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `authenticationId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, connectionId: string, authenticationId: string) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'provider-oauth',
        'connections',
        connectionId,
        'authentications',
        authenticationId
      ]
    }).transform(
      mapDashboardInstanceProviderOauthConnectionsAuthenticationsGetOutput
    );
  }
}
