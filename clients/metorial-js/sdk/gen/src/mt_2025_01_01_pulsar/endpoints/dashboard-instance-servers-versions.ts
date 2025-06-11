import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersVersionsGetOutput,
  mapDashboardInstanceServersVersionsListOutput,
  mapDashboardInstanceServersVersionsListQuery,
  type DashboardInstanceServersVersionsGetOutput,
  type DashboardInstanceServersVersionsListOutput,
  type DashboardInstanceServersVersionsListQuery
} from '../resources';

/**
 * @name Server Version controller
 * @description Read and write server version information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServersVersionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description List all server versions
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   * @param `query` - DashboardInstanceServersVersionsListQuery
   *
   * @returns DashboardInstanceServersVersionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    serverId: string,
    query?: DashboardInstanceServersVersionsListQuery
  ) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'servers',
        serverId,
        'versions'
      ],

      query: query
        ? mapDashboardInstanceServersVersionsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersVersionsListOutput);
  }

  /**
   * @name Get server version
   * @description Get the information of a specific server version
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   * @param `serverVersionId` - string
   *
   * @returns DashboardInstanceServersVersionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverId: string, serverVersionId: string) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'servers',
        serverId,
        'versions',
        serverVersionId
      ]
    }).transform(mapDashboardInstanceServersVersionsGetOutput);
  }
}
