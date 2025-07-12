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
export class MetorialManagementInstanceServersVersionsEndpoint extends BaseMetorialEndpoint<any> {
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
  ): Promise<DashboardInstanceServersVersionsListOutput> {
    let path = `instances/${instanceId}/servers/${serverId}/versions`;
    return this._get({
      path,

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
  get(
    instanceId: string,
    serverId: string,
    serverVersionId: string
  ): Promise<DashboardInstanceServersVersionsGetOutput> {
    let path = `instances/${instanceId}/servers/${serverId}/versions/${serverVersionId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServersVersionsGetOutput);
  }
}
