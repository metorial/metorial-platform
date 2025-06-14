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
 * @name Server Instance controller
 * @description Read and write server instance information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersImplementationsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server instances
   * @description List all server instances
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
   * @name Get server instance
   * @description Get the information of a specific server instance
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
   * @name Create server instance
   * @description Create a new server instance
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
   * @name Update server instance
   * @description Update a server instance
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
   * @name Delete server instance
   * @description Delete a server instance
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
