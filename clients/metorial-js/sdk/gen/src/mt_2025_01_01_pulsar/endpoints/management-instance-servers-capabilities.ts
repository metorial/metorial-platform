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
 * @name ServerCapabilities controller
 * @description Provides access to server capability definitions for the current instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersCapabilitiesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List server capabilities
   * @description Returns a list of server capabilities, filterable by server attributes such as deployment, variant, or version.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceServersCapabilitiesListQuery
   *
   * @returns DashboardInstanceServersCapabilitiesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceServersCapabilitiesListQuery
  ) {
    return this._get({
      path: ['instances', instanceId, 'server-capabilities'],

      query: query
        ? mapDashboardInstanceServersCapabilitiesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardInstanceServersCapabilitiesListOutput);
  }
}
