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
export class MetorialServersVariantsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server variants
   * @description Retrieve all variants for a given server
   *
   * @param `serverId` - string
   * @param `query` - DashboardInstanceServersVariantsListQuery
   *
   * @returns DashboardInstanceServersVariantsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(serverId: string, query?: DashboardInstanceServersVariantsListQuery) {
    return this._get({
      path: ['servers', serverId, 'variants'],

      query: query
        ? mapDashboardInstanceServersVariantsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersVariantsListOutput);
  }

  /**
   * @name Get server variant
   * @description Retrieve details for a specific server variant
   *
   * @param `serverId` - string
   * @param `serverVariantId` - string
   *
   * @returns DashboardInstanceServersVariantsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverId: string, serverVariantId: string) {
    return this._get({
      path: ['servers', serverId, 'variants', serverVariantId]
    }).transform(mapDashboardInstanceServersVariantsGetOutput);
  }
}
