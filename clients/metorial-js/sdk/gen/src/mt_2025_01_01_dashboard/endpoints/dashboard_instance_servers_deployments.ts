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
export class MetorialDashboardInstanceServersDeploymentsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server deployments
   * @description List all server deployments
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersDeploymentsListQuery
   *
   * @returns DashboardInstanceServersDeploymentsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServersDeploymentsListQuery
  ): Promise<DashboardInstanceServersDeploymentsListOutput> {
    let path = `dashboard/instances/${instanceId}/server-deployments`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceServersDeploymentsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersDeploymentsListOutput);
  }

  /**
   * @name Get server instance
   * @description Get the information of a specific server instance
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   *
   * @returns DashboardInstanceServersDeploymentsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverDeploymentId: string
  ): Promise<DashboardInstanceServersDeploymentsGetOutput> {
    let path = `dashboard/instances/${instanceId}/server-deployments/${serverDeploymentId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServersDeploymentsGetOutput);
  }

  /**
   * @name Create server instance
   * @description Create a new server instance
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceServersDeploymentsCreateBody
   *
   * @returns DashboardInstanceServersDeploymentsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceServersDeploymentsCreateBody
  ): Promise<DashboardInstanceServersDeploymentsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/server-deployments`;
    return this._post({
      path,
      body: mapDashboardInstanceServersDeploymentsCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersDeploymentsCreateOutput);
  }

  /**
   * @name Update server instance
   * @description Update a server instance
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   * @param `body` - DashboardInstanceServersDeploymentsUpdateBody
   *
   * @returns DashboardInstanceServersDeploymentsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    serverDeploymentId: string,
    body: DashboardInstanceServersDeploymentsUpdateBody
  ): Promise<DashboardInstanceServersDeploymentsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/server-deployments/${serverDeploymentId}`;
    return this._patch({
      path,
      body: mapDashboardInstanceServersDeploymentsUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersDeploymentsUpdateOutput);
  }

  /**
   * @name Delete server instance
   * @description Delete a server instance
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   *
   * @returns DashboardInstanceServersDeploymentsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    serverDeploymentId: string
  ): Promise<DashboardInstanceServersDeploymentsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/server-deployments/${serverDeploymentId}`;
    return this._delete({
      path
    }).transform(mapDashboardInstanceServersDeploymentsDeleteOutput);
  }
}
