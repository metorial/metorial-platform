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
 * @description Servers in Metorial are version controlled. Metorial automatically updates servers to the latest version when available. These endpoints help you keep track of server versions in the Metorial catalog.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersVersionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description Retrieve all versions for a given server
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
      path: ['instances', instanceId, 'servers', serverId, 'versions'],

      query: query
        ? mapDashboardInstanceServersVersionsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersVersionsListOutput);
  }

  /**
   * @name Get server version
   * @description Retrieve details for a specific server version
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
