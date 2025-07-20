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
 * @description Each time an MCP server is executed by the Metorial platform, a server run is created. This allows you to track the execution of MCP servers, including their status and associated sessions. Metorial may create multiple server runs for a single session or session connection.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServerRunsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server runs
   * @description List all server runs
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServerRunsListQuery
   *
   * @returns DashboardInstanceServerRunsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(instanceId: string, query?: DashboardInstanceServerRunsListQuery) {
    return this._get({
      path: ['instances', instanceId, 'server-runs'],

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
  get(instanceId: string, serverRunId: string) {
    return this._get({
      path: ['instances', instanceId, 'server-runs', serverRunId]
    }).transform(mapDashboardInstanceServerRunsGetOutput);
  }
}
