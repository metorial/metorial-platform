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
 * @name ServerVersion controller
 * @description Manage server version data
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersVersionsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server versions
   * @description Retrieve all versions for a given server
   *
   * @param `serverId` - string
   * @param `query` - DashboardInstanceServersVersionsListQuery
   *
   * @returns DashboardInstanceServersVersionsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(serverId: string, query?: DashboardInstanceServersVersionsListQuery) {
    return this._get({
      path: ['servers', serverId, 'versions'],

      query: query
        ? mapDashboardInstanceServersVersionsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersVersionsListOutput);
  }

  /**
   * @name Get server version
   * @description Retrieve details for a specific server version
   *
   * @param `serverId` - string
   * @param `serverVersionId` - string
   *
   * @returns DashboardInstanceServersVersionsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverId: string, serverVersionId: string) {
    return this._get({
      path: ['servers', serverId, 'versions', serverVersionId]
    }).transform(mapDashboardInstanceServersVersionsGetOutput);
  }
}
