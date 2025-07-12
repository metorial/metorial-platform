import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceServersGetOutput,
  type DashboardInstanceServersGetOutput
} from '../resources';

/**
 * @name Server controller
 * @description Read and write server information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialServersEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get server
   * @description Get the information of a specific server
   *
   * @param `serverId` - string
   *
   * @returns DashboardInstanceServersGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(serverId: string): Promise<DashboardInstanceServersGetOutput> {
    let path = `servers/${serverId}`;
    return this._get({
      path
    }).transform(mapDashboardInstanceServersGetOutput);
  }
}
