import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersInstancesCreateBody,
  mapDashboardInstanceServersInstancesCreateOutput,
  mapDashboardInstanceServersInstancesDeleteOutput,
  mapDashboardInstanceServersInstancesGetOutput,
  mapDashboardInstanceServersInstancesListOutput,
  mapDashboardInstanceServersInstancesListQuery,
  mapDashboardInstanceServersInstancesUpdateBody,
  mapDashboardInstanceServersInstancesUpdateOutput,
  type DashboardInstanceServersInstancesCreateBody,
  type DashboardInstanceServersInstancesCreateOutput,
  type DashboardInstanceServersInstancesDeleteOutput,
  type DashboardInstanceServersInstancesGetOutput,
  type DashboardInstanceServersInstancesListOutput,
  type DashboardInstanceServersInstancesListQuery,
  type DashboardInstanceServersInstancesUpdateBody,
  type DashboardInstanceServersInstancesUpdateOutput
} from '../resources';

/**
 * @name Server Instance controller
 * @description Read and write server instance information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersInstancesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server instances
   * @description List all server instances
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersInstancesListQuery
   *
   * @returns DashboardInstanceServersInstancesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, query?: DashboardInstanceServersInstancesListQuery) {
    return this._get({
      path: ['instances', instanceId, 'instances'],

      query: query
        ? mapDashboardInstanceServersInstancesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersInstancesListOutput);
  }

  /**
   * @name Get server instance
   * @description Get the information of a specific server instance
   *
   * @param `instanceId` - string
   * @param `serverInstanceId` - string
   *
   * @returns DashboardInstanceServersInstancesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverInstanceId: string) {
    return this._get({
      path: ['instances', instanceId, 'instances', serverInstanceId]
    }).transform(mapDashboardInstanceServersInstancesGetOutput);
  }

  /**
   * @name Create server instance
   * @description Create a new server instance
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceServersInstancesCreateBody
   *
   * @returns DashboardInstanceServersInstancesCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceServersInstancesCreateBody
  ) {
    return this._post({
      path: ['instances', instanceId, 'instances'],
      body: mapDashboardInstanceServersInstancesCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersInstancesCreateOutput);
  }

  /**
   * @name Update server instance
   * @description Update a server instance
   *
   * @param `instanceId` - string
   * @param `serverInstanceId` - string
   * @param `body` - DashboardInstanceServersInstancesUpdateBody
   *
   * @returns DashboardInstanceServersInstancesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    serverInstanceId: string,
    body: DashboardInstanceServersInstancesUpdateBody
  ) {
    return this._patch({
      path: ['instances', instanceId, 'instances', serverInstanceId],
      body: mapDashboardInstanceServersInstancesUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersInstancesUpdateOutput);
  }

  /**
   * @name Delete server instance
   * @description Delete a server instance
   *
   * @param `instanceId` - string
   * @param `serverInstanceId` - string
   *
   * @returns DashboardInstanceServersInstancesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(instanceId: string, serverInstanceId: string) {
    return this._delete({
      path: ['instances', instanceId, 'instances', serverInstanceId]
    }).transform(mapDashboardInstanceServersInstancesDeleteOutput);
  }
}
