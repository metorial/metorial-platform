import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersVariantsGetOutput,
  mapDashboardInstanceServersVariantsListOutput,
  mapDashboardInstanceServersVariantsListQuery,
  type DashboardInstanceServersVariantsGetOutput,
  type DashboardInstanceServersVariantsListOutput,
  type DashboardInstanceServersVariantsListQuery
} from '../resources';

/**
 * @name Server Variant controller
 * @description Read and write server variant information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersVariantsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server variants
   * @description List all server variants
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   * @param `query` - DashboardInstanceServersVariantsListQuery
   *
   * @returns DashboardInstanceServersVariantsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    serverId: string,
    query?: DashboardInstanceServersVariantsListQuery
  ): Promise<DashboardInstanceServersVariantsListOutput> {
    let path = `instances/${instanceId}/servers/${serverId}/variants`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceServersVariantsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersVariantsListOutput);
  }

  /**
   * @name Get server variant
   * @description Get the information of a specific server variant
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   * @param `serverVariantId` - string
   *
   * @returns DashboardInstanceServersVariantsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    serverId: string,
    serverVariantId: string
  ): Promise<DashboardInstanceServersVariantsGetOutput> {
    let path = `instances/${instanceId}/servers/${serverId}/variants/${serverVariantId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServersVariantsGetOutput);
  }
}
