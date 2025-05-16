import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersDeploymentsCreateBody,
  mapDashboardInstanceServersDeploymentsCreateOutput,
  mapDashboardInstanceServersDeploymentsDeleteOutput,
  mapDashboardInstanceServersDeploymentsGetOutput,
  mapDashboardInstanceServersDeploymentsListOutput,
  mapDashboardInstanceServersDeploymentsListQuery,
  mapDashboardInstanceServersDeploymentsUpdateBody,
  mapDashboardInstanceServersDeploymentsUpdateOutput,
  type DashboardInstanceServersDeploymentsCreateBody,
  type DashboardInstanceServersDeploymentsCreateOutput,
  type DashboardInstanceServersDeploymentsDeleteOutput,
  type DashboardInstanceServersDeploymentsGetOutput,
  type DashboardInstanceServersDeploymentsListOutput,
  type DashboardInstanceServersDeploymentsListQuery,
  type DashboardInstanceServersDeploymentsUpdateBody,
  type DashboardInstanceServersDeploymentsUpdateOutput
} from '../resources';

/**
 * @name Server Instance controller
 * @description Read and write server instance information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersDeploymentsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server deployments
   * @description List all server deployments
   *
   * @param `query` - DashboardInstanceServersDeploymentsListQuery
   *
   * @returns DashboardInstanceServersDeploymentsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceServersDeploymentsListQuery) {
    return this._get({
      path: ['deployments'],

      query: query
        ? mapDashboardInstanceServersDeploymentsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersDeploymentsListOutput);
  }

  /**
   * @name Get server instance
   * @description Get the information of a specific server instance
   *
   * @param `serverDeploymentId` - string
   *
   * @returns DashboardInstanceServersDeploymentsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverDeploymentId: string) {
    return this._get({
      path: ['deployments', serverDeploymentId]
    }).transform(mapDashboardInstanceServersDeploymentsGetOutput);
  }

  /**
   * @name Create server instance
   * @description Create a new server instance
   *
   * @param `body` - DashboardInstanceServersDeploymentsCreateBody
   *
   * @returns DashboardInstanceServersDeploymentsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(body: DashboardInstanceServersDeploymentsCreateBody) {
    return this._post({
      path: ['deployments'],
      body: mapDashboardInstanceServersDeploymentsCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersDeploymentsCreateOutput);
  }

  /**
   * @name Update server instance
   * @description Update a server instance
   *
   * @param `serverDeploymentId` - string
   * @param `body` - DashboardInstanceServersDeploymentsUpdateBody
   *
   * @returns DashboardInstanceServersDeploymentsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    serverDeploymentId: string,
    body: DashboardInstanceServersDeploymentsUpdateBody
  ) {
    return this._patch({
      path: ['deployments', serverDeploymentId],
      body: mapDashboardInstanceServersDeploymentsUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersDeploymentsUpdateOutput);
  }

  /**
   * @name Delete server instance
   * @description Delete a server instance
   *
   * @param `serverDeploymentId` - string
   *
   * @returns DashboardInstanceServersDeploymentsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(serverDeploymentId: string) {
    return this._delete({
      path: ['deployments', serverDeploymentId]
    }).transform(mapDashboardInstanceServersDeploymentsDeleteOutput);
  }
}
