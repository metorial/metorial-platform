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
export class MetorialServersVariantsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server variants
   * @description List all server variants
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
   * @description Get the information of a specific server variant
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
