import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersGetOutput,
  type DashboardInstanceServersGetOutput
} from '../resources';

/**
 * @name Servers controller
 * @description Endpoint for retrieving information about a specific server within an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceServersEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get server by ID
   * @description Retrieves detailed information for a server identified by its ID.
   *
   * @param `instanceId` - string
   * @param `serverId` - string
   *
   * @returns DashboardInstanceServersGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string, serverId: string) {
    return this._get({
      path: ['instances', instanceId, 'servers', serverId]
    }).transform(mapDashboardInstanceServersGetOutput);
  }
}
