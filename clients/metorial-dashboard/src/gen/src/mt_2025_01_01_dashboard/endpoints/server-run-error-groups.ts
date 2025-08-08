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
export class MetorialServerRunErrorGroupsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server run error groups
   * @description List all server run error groups
   *
   * @param `query` - DashboardInstanceServerRunErrorGroupsListQuery
   *
   * @returns DashboardInstanceServerRunErrorGroupsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceServerRunErrorGroupsListQuery
  ): Promise<DashboardInstanceServerRunErrorGroupsListOutput> {
    let path = 'server-run-error-groups';
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceServerRunErrorGroupsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServerRunErrorGroupsListOutput);
  }

  /**
   * @name Get server run error group
   * @description Get the information of a specific server run error group
   *
   * @param `serverRunErrorGroupId` - string
   *
   * @returns DashboardInstanceServerRunErrorGroupsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    serverRunErrorGroupId: string
  ): Promise<DashboardInstanceServerRunErrorGroupsGetOutput> {
    let path = `server-run-error-groups/${serverRunErrorGroupId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServerRunErrorGroupsGetOutput);
  }
}
