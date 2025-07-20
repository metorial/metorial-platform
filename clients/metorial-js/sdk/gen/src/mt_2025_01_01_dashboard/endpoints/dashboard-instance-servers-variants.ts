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
 * @name ServerVariant controller
 * @description Manage server variant data
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
  ) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'servers',
        serverId,
        'variants'
      ],

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
  get(instanceId: string, serverId: string, serverVariantId: string) {
    return this._get({
      path: [
        'dashboard',
        'instances',
        instanceId,
        'servers',
        serverId,
        'variants',
        serverVariantId
      ]
    }).transform(mapDashboardInstanceServersVariantsGetOutput);
  }
}
