import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServerRunsGetOutput,
  mapDashboardInstanceServerRunsListOutput,
  mapDashboardInstanceServerRunsListQuery,
  type DashboardInstanceServerRunsGetOutput,
  type DashboardInstanceServerRunsListOutput,
  type DashboardInstanceServerRunsListQuery
} from '../resources';

/**
 * @name Server Run controller
 * @description Read and write server run information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServerRunsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server deployments
   * @description List all server deployments
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServerRunsListQuery
   *
   * @returns DashboardInstanceServerRunsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServerRunsListQuery
  ): Promise<DashboardInstanceServerRunsListOutput> {
    let path = `dashboard/instances/${instanceId}/server-runs`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceServerRunsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServerRunsListOutput);
  }

  /**
   * @name Get server run
   * @description Get the information of a specific server run
   *
   * @param `instanceId` - string
   * @param `serverRunId` - string
   *
   * @returns DashboardInstanceServerRunsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverRunId: string
  ): Promise<DashboardInstanceServerRunsGetOutput> {
    let path = `dashboard/instances/${instanceId}/server-runs/${serverRunId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServerRunsGetOutput);
  }
}
