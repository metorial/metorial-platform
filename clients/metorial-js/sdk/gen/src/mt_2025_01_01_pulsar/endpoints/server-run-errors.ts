import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServerRunErrorsGetOutput,
  mapDashboardInstanceServerRunErrorsListOutput,
  mapDashboardInstanceServerRunErrorsListQuery,
  type DashboardInstanceServerRunErrorsGetOutput,
  type DashboardInstanceServerRunErrorsListOutput,
  type DashboardInstanceServerRunErrorsListQuery
} from '../resources';

/**
 * @name Server Run Error controller
 * @description Read and write server run error information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServerRunErrorsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server run errors
   * @description List all server run errors
   *
   * @param `query` - DashboardInstanceServerRunErrorsListQuery
   *
   * @returns DashboardInstanceServerRunErrorsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceServerRunErrorsListQuery) {
    return this._get({
      path: ['server-run-errors'],

      query: query
        ? mapDashboardInstanceServerRunErrorsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServerRunErrorsListOutput);
  }

  /**
   * @name Get server run error
   * @description Get the information of a specific server run error
   *
   * @param `serverRunErrorId` - string
   *
   * @returns DashboardInstanceServerRunErrorsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverRunErrorId: string) {
    return this._get({
      path: ['server-run-errors', serverRunErrorId]
    }).transform(mapDashboardInstanceServerRunErrorsGetOutput);
  }
}
