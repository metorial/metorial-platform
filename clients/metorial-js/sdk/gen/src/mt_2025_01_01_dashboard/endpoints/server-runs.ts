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
export class MetorialServerRunsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server runs
   * @description List all server runs
   *
   * @param `query` - DashboardInstanceServerRunsListQuery
   *
   * @returns DashboardInstanceServerRunsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceServerRunsListQuery) {
    return this._get({
      path: ['server-runs'],

      query: query
        ? mapDashboardInstanceServerRunsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServerRunsListOutput);
  }

  /**
   * @name Get server run
   * @description Get the information of a specific server run
   *
   * @param `serverRunId` - string
   *
   * @returns DashboardInstanceServerRunsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverRunId: string) {
    return this._get({
      path: ['server-runs', serverRunId]
    }).transform(mapDashboardInstanceServerRunsGetOutput);
  }
}
