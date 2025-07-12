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
  list(
    query?: DashboardInstanceServersImplementationsListQuery
  ): Promise<DashboardInstanceServersImplementationsListOutput> {
    let path = 'server-implementations';
    return this._get({
      path,

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
  get(
    serverImplementationId: string
  ): Promise<DashboardInstanceServersImplementationsGetOutput> {
    let path = `server-implementations/${serverImplementationId}`;
    return this._get({
      path
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
  create(
    body: DashboardInstanceServersImplementationsCreateBody
  ): Promise<DashboardInstanceServersImplementationsCreateOutput> {
    let path = 'server-implementations';
    return this._post({
      path,
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
  ): Promise<DashboardInstanceServersImplementationsUpdateOutput> {
    let path = `server-implementations/${serverImplementationId}`;
    return this._patch({
      path,
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
  delete(
    serverImplementationId: string
  ): Promise<DashboardInstanceServersImplementationsDeleteOutput> {
    let path = `server-implementations/${serverImplementationId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceServersImplementationsDeleteOutput);
  }
}
