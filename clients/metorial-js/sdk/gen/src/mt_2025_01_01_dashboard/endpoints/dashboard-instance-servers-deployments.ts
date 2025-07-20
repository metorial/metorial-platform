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
 * @name Server Deployment controller
 * @description A server deployment represents a specific instance of an MCP server that can be connected to. It contains configuration for the MCP server, such as API keys for the underlying MCP server.
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
   * @description Retrieve a list of server deployments within the instance. Supports filtering by status, server, variant, and session.
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
  ) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'server-deployments'],

      query: query
        ? mapDashboardInstanceServersDeploymentsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersDeploymentsListOutput);
  }

  /**
   * @name Get server deployment
   * @description Fetch detailed information about a specific server deployment.
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   *
   * @returns DashboardInstanceServersDeploymentsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverDeploymentId: string) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'server-deployments',
        serverDeploymentId
      ]
    }).transform(mapDashboardInstanceServersDeploymentsGetOutput);
  }

  /**
   * @name Create server deployment
   * @description Create a new server deployment using an existing or newly defined server implementation.
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
  ) {
    return this._post({
      path: ['dashboard', 'instances', instanceId, 'server-deployments'],
      body: mapDashboardInstanceServersDeploymentsCreateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersDeploymentsCreateOutput);
  }

  /**
   * @name Update server deployment
   * @description Update metadata, configuration, or other properties of a server deployment.
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
  ) {
    return this._patch({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'server-deployments',
        serverDeploymentId
      ],
      body: mapDashboardInstanceServersDeploymentsUpdateBody.transformTo(body)
    }).transform(mapDashboardInstanceServersDeploymentsUpdateOutput);
  }

  /**
   * @name Delete server deployment
   * @description Delete a server deployment from the instance.
   *
   * @param `instanceId` - string
   * @param `serverDeploymentId` - string
   *
   * @returns DashboardInstanceServersDeploymentsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(instanceId: string, serverDeploymentId: string) {
    return this._delete({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'server-deployments',
        serverDeploymentId
      ]
    }).transform(mapDashboardInstanceServersDeploymentsDeleteOutput);
  }
}
