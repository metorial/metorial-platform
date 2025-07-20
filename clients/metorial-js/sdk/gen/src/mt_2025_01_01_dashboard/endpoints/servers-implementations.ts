import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersImplementationsCreateBody,
  mapDashboardInstanceServersImplementationsCreateOutput,
  mapDashboardInstanceServersImplementationsDeleteOutput,
  mapDashboardInstanceServersImplementationsGetOutput,
  mapDashboardInstanceServersImplementationsListOutput,
  mapDashboardInstanceServersImplementationsListQuery,
  mapDashboardInstanceServersImplementationsUpdateBody,
  mapDashboardInstanceServersImplementationsUpdateOutput,
  type DashboardInstanceServersImplementationsCreateBody,
  type DashboardInstanceServersImplementationsCreateOutput,
  type DashboardInstanceServersImplementationsDeleteOutput,
  type DashboardInstanceServersImplementationsGetOutput,
  type DashboardInstanceServersImplementationsListOutput,
  type DashboardInstanceServersImplementationsListQuery,
  type DashboardInstanceServersImplementationsUpdateBody,
  type DashboardInstanceServersImplementationsUpdateOutput
} from '../resources';

/**
 * @name Server Implementation controller
 * @description Server implementations allow you to customize predefined MCP servers with specific configurations, launch parameters, and metadata. You can create server deployments based on these implementations to connect to the underlying MCP servers.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersImplementationsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server implementations
   * @description Retrieve all server implementations in the instance. Supports filtering by status, server, or variant.
   *
   * @param `query` - DashboardInstanceServersImplementationsListQuery
   *
   * @returns DashboardInstanceServersImplementationsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceServersImplementationsListQuery) {
    return this._get({
      path: ['server-implementations'],

      query: query
        ? mapDashboardInstanceServersImplementationsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersImplementationsListOutput);
  }

  /**
   * @name Get server implementation
   * @description Fetch detailed information about a specific server implementation.
   *
   * @param `serverImplementationId` - string
   *
   * @returns DashboardInstanceServersImplementationsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverImplementationId: string) {
    return this._get({
      path: ['server-implementations', serverImplementationId]
    }).transform(mapDashboardInstanceServersImplementationsGetOutput);
  }

  /**
   * @name Create server implementation
   * @description Create a new server implementation for a specific server or server variant.
   *
   * @param `body` - DashboardInstanceServersImplementationsCreateBody
   *
   * @returns DashboardInstanceServersImplementationsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(body: DashboardInstanceServersImplementationsCreateBody) {
    return this._post({
      path: ['server-implementations'],
      body: mapDashboardInstanceServersImplementationsCreateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceServersImplementationsCreateOutput);
  }

  /**
   * @name Update server implementation
   * @description Update metadata, launch parameters, or other fields of a server implementation.
   *
   * @param `serverImplementationId` - string
   * @param `body` - DashboardInstanceServersImplementationsUpdateBody
   *
   * @returns DashboardInstanceServersImplementationsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    serverImplementationId: string,
    body: DashboardInstanceServersImplementationsUpdateBody
  ) {
    return this._patch({
      path: ['server-implementations', serverImplementationId],
      body: mapDashboardInstanceServersImplementationsUpdateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceServersImplementationsUpdateOutput);
  }

  /**
   * @name Delete server implementation
   * @description Delete a specific server implementation from the instance.
   *
   * @param `serverImplementationId` - string
   *
   * @returns DashboardInstanceServersImplementationsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(serverImplementationId: string) {
    return this._delete({
      path: ['server-implementations', serverImplementationId]
    }).transform(mapDashboardInstanceServersImplementationsDeleteOutput);
  }
}
