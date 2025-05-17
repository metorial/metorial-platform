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
export class MetorialManagementInstanceServerRunErrorsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server deployments
   * @description List all server deployments
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServerRunErrorsListQuery
   *
   * @returns DashboardInstanceServerRunErrorsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, query?: DashboardInstanceServerRunErrorsListQuery) {
    return this._get({
      path: ['instances', instanceId, 'server-run-errors'],

      query: query
        ? mapDashboardInstanceServerRunErrorsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServerRunErrorsListOutput);
  }

  /**
   * @name Get server run error
   * @description Get the information of a specific server run error
   *
   * @param `instanceId` - string
   * @param `serverRunErrorId` - string
   *
   * @returns DashboardInstanceServerRunErrorsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverRunErrorId: string) {
    return this._get({
      path: ['instances', instanceId, 'server-run-errors', serverRunErrorId]
    }).transform(mapDashboardInstanceServerRunErrorsGetOutput);
  }
}
