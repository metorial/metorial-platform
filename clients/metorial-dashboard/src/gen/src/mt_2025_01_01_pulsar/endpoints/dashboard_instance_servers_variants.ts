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
 * @description Server variants define different instances of a server, each with its own configuration and capabilities. By default, Metorial picks the best variant automatically, but you can specify a variant if needed.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceServersVariantsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server variants
   * @description Retrieve all variants for a given server
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
    let path = `dashboard/instances/${instanceId}/servers/${serverId}/variants`;
    return this._get({
      path,

      query: query
        ? mapDashboardInstanceServersVariantsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersVariantsListOutput);
  }

  /**
   * @name Get server variant
   * @description Retrieve details for a specific server variant
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
    let path = `dashboard/instances/${instanceId}/servers/${serverId}/variants/${serverVariantId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServersVariantsGetOutput);
  }
}
