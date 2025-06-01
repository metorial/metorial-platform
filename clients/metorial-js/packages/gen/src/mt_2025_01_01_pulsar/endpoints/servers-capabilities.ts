import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersCapabilitiesListOutput,
  mapDashboardInstanceServersCapabilitiesListQuery,
  type DashboardInstanceServersCapabilitiesListOutput,
  type DashboardInstanceServersCapabilitiesListQuery
} from '../resources';

/**
 * @name Server Capabilities controller
 * @description Get server capabilities information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersCapabilitiesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server capabilities
   * @description List all server capabilities
   *
   * @param `query` - DashboardInstanceServersCapabilitiesListQuery
   *
   * @returns DashboardInstanceServersCapabilitiesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardInstanceServersCapabilitiesListQuery) {
    return this._get({
      path: ['server-capabilities'],

      query: query
        ? mapDashboardInstanceServersCapabilitiesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersCapabilitiesListOutput);
  }
}
