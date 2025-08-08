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
export class MetorialProviderOauthConnectionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List provider OAuth connections
   * @description List all provider OAuth connections
   *
   * @param `query` - DashboardInstanceProviderOauthConnectionsListQuery
   *
   * @returns DashboardInstanceProviderOauthConnectionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderOauthConnectionsListQuery
  ): Promise<DashboardInstanceProviderOauthConnectionsListOutput> {
    let path = 'provider-oauth/connections';
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceProviderOauthConnectionsListQuery.transformTo(
            query
          )
        : undefined
    }).transform(mapDashboardInstanceProviderOauthConnectionsListOutput);
  }

  /**
   * @name Create provider OAuth connection
   * @description Create a new provider OAuth connection
   *
   * @param `body` - DashboardInstanceProviderOauthConnectionsCreateBody
   *
   * @returns DashboardInstanceProviderOauthConnectionsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceProviderOauthConnectionsCreateBody
  ): Promise<DashboardInstanceProviderOauthConnectionsCreateOutput> {
    let path = 'provider-oauth/connections';
    return this._post({
      path,
      body: mapDashboardInstanceProviderOauthConnectionsCreateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceProviderOauthConnectionsCreateOutput);
  }

  /**
   * @name Get provider OAuth connection
   * @description Get information for a specific provider OAuth connection
   *
   * @param `connectionId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    connectionId: string
  ): Promise<DashboardInstanceProviderOauthConnectionsGetOutput> {
    let path = `provider-oauth/connections/${connectionId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceProviderOauthConnectionsGetOutput);
  }

  /**
   * @name Update provider OAuth connection
   * @description Update a provider OAuth connection
   *
   * @param `connectionId` - string
   * @param `body` - DashboardInstanceProviderOauthConnectionsUpdateBody
   *
   * @returns DashboardInstanceProviderOauthConnectionsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    connectionId: string,
    body: DashboardInstanceProviderOauthConnectionsUpdateBody
  ): Promise<DashboardInstanceProviderOauthConnectionsUpdateOutput> {
    let path = `provider-oauth/connections/${connectionId}`;
    return this._patch({
      path,
      body: mapDashboardInstanceProviderOauthConnectionsUpdateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceProviderOauthConnectionsUpdateOutput);
  }

  /**
   * @name Delete provider OAuth connection
   * @description Delete a provider OAuth connection
   *
   * @param `connectionId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    connectionId: string
  ): Promise<DashboardInstanceProviderOauthConnectionsDeleteOutput> {
    let path = `provider-oauth/connections/${connectionId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceProviderOauthConnectionsDeleteOutput);
  }
}
