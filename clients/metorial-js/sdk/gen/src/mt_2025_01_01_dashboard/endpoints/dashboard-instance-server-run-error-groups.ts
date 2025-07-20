import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServerRunErrorGroupsGetOutput,
  mapDashboardInstanceServerRunErrorGroupsListOutput,
  mapDashboardInstanceServerRunErrorGroupsListQuery,
  type DashboardInstanceServerRunErrorGroupsGetOutput,
  type DashboardInstanceServerRunErrorGroupsListOutput,
  type DashboardInstanceServerRunErrorGroupsListQuery
} from '../resources';

/**
 * @name Server Run Error Group controller
 * @description Read and write server run error group information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServerRunErrorGroupsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server run error groups
   * @description List all server run error groups
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServerRunErrorGroupsListQuery
   *
   * @returns DashboardInstanceServerRunErrorGroupsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServerRunErrorGroupsListQuery
  ) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'server-run-error-groups'],

      query: query
        ? mapDashboardInstanceServerRunErrorGroupsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServerRunErrorGroupsListOutput);
  }

  /**
   * @name Get server run error group
   * @description Get the information of a specific server run error group
   *
   * @param `instanceId` - string
   * @param `serverRunErrorGroupId` - string
   *
   * @returns DashboardInstanceServerRunErrorGroupsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverRunErrorGroupId: string) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'server-run-error-groups',
        serverRunErrorGroupId
      ]
    }).transform(mapDashboardInstanceServerRunErrorGroupsGetOutput);
  }
}
