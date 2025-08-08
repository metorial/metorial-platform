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
 * @description Sometimes, an MCP server may fail to run correctly, resulting in an error. Metorial captures these errors to help you diagnose issues with your server runs. You may also want to check the Metorial dashboard for more details on the error.
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
  list(
    query?: DashboardInstanceServerRunErrorsListQuery
  ): Promise<DashboardInstanceServerRunErrorsListOutput> {
    let path = 'server-run-errors';
    return this._get({
      path,

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
  get(
    serverRunErrorId: string
  ): Promise<DashboardInstanceServerRunErrorsGetOutput> {
    let path = `server-run-errors/${serverRunErrorId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServerRunErrorsGetOutput);
  }
}
