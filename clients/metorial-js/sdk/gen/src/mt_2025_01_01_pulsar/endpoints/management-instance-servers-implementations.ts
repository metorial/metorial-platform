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
export class MetorialManagementInstanceServersImplementationsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server instances
   * @description List all server instances
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersImplementationsListQuery
   *
   * @returns DashboardInstanceServersImplementationsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServersImplementationsListQuery
  ) {
    return this._get({
      path: ['instances', instanceId, 'server-implementations'],

      query: query
        ? mapDashboardInstanceServersImplementationsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersImplementationsListOutput);
  }

  /**
   * @name Get server instance
   * @description Get the information of a specific server instance
   *
   * @param `instanceId` - string
   * @param `serverImplementationId` - string
   *
   * @returns DashboardInstanceServersImplementationsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverImplementationId: string) {
    return this._get({
      path: [
        'instances',
        instanceId,
        'server-implementations',
        serverImplementationId
      ]
    }).transform(mapDashboardInstanceServersImplementationsGetOutput);
  }

  /**
   * @name Create server instance
   * @description Create a new server instance
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceServersImplementationsCreateBody
   *
   * @returns DashboardInstanceServersImplementationsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceServersImplementationsCreateBody
  ) {
    return this._post({
      path: ['instances', instanceId, 'server-implementations'],
      body: mapDashboardInstanceServersImplementationsCreateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceServersImplementationsCreateOutput);
  }

  /**
   * @name Update server instance
   * @description Update a server instance
   *
   * @param `instanceId` - string
   * @param `serverImplementationId` - string
   * @param `body` - DashboardInstanceServersImplementationsUpdateBody
   *
   * @returns DashboardInstanceServersImplementationsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    serverImplementationId: string,
    body: DashboardInstanceServersImplementationsUpdateBody
  ) {
    return this._patch({
      path: [
        'instances',
        instanceId,
        'server-implementations',
        serverImplementationId
      ],
      body: mapDashboardInstanceServersImplementationsUpdateBody.transformTo(
        body
      )
    }).transform(mapDashboardInstanceServersImplementationsUpdateOutput);
  }

  /**
   * @name Delete server instance
   * @description Delete a server instance
   *
   * @param `instanceId` - string
   * @param `serverImplementationId` - string
   *
   * @returns DashboardInstanceServersImplementationsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(instanceId: string, serverImplementationId: string) {
    return this._delete({
      path: [
        'instances',
        instanceId,
        'server-implementations',
        serverImplementationId
      ]
    }).transform(mapDashboardInstanceServersImplementationsDeleteOutput);
  }
}
