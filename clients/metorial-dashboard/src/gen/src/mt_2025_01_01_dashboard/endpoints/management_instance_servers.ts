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
 * @description A server represents a deployable MCP server in Metorial's catalog. You can use server deployments to create MCP server instances that you can connect to.
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
  get(
    instanceId: string,
    serverId: string
  ): Promise<DashboardInstanceServersGetOutput> {
    let path = `instances/${instanceId}/servers/${serverId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServersGetOutput);
  }
}
