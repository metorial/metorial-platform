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
 * @name Provider OAuth Connection controller
 * @description Manage provider OAuth connection information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderOauthConnectionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List provider OAuth connections
   * @description List all provider OAuth connections
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderOauthConnectionsListQuery
   *
   * @returns DashboardInstanceProviderOauthConnectionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderOauthConnectionsListQuery
  ) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'provider-oauth',
        'connections'
      ],

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
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceProviderOauthConnectionsCreateBody
   *
   * @returns DashboardInstanceProviderOauthConnectionsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceProviderOauthConnectionsCreateBody
  ) {
    return this._post({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'provider-oauth',
        'connections'
      ],
      body: mapDashboardInstanceProviderOauthConnectionsCreateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceProviderOauthConnectionsCreateOutput);
  }

  /**
   * @name Get provider OAuth connection
   * @description Get information for a specific provider OAuth connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, connectionId: string) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'provider-oauth',
        'connections',
        connectionId
      ]
    }).transform(mapDashboardInstanceProviderOauthConnectionsGetOutput);
  }

  /**
   * @name Update provider OAuth connection
   * @description Update a provider OAuth connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   * @param `body` - DashboardInstanceProviderOauthConnectionsUpdateBody
   *
   * @returns DashboardInstanceProviderOauthConnectionsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    connectionId: string,
    body: DashboardInstanceProviderOauthConnectionsUpdateBody
  ) {
    return this._patch({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'provider-oauth',
        'connections',
        connectionId
      ],
      body: mapDashboardInstanceProviderOauthConnectionsUpdateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceProviderOauthConnectionsUpdateOutput);
  }

  /**
   * @name Delete provider OAuth connection
   * @description Delete a provider OAuth connection
   *
   * @param `instanceId` - string
   * @param `connectionId` - string
   *
   * @returns DashboardInstanceProviderOauthConnectionsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(instanceId: string, connectionId: string) {
    return this._delete({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'provider-oauth',
        'connections',
        connectionId
      ]
    }).transform(mapDashboardInstanceProviderOauthConnectionsDeleteOutput);
  }
}
