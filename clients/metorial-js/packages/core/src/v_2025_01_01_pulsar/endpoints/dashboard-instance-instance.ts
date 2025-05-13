import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceInstanceGetOutput,
  type DashboardInstanceInstanceGetOutput
} from '../resources';

/**
 * @name Instance controller
 * @description Read and write instance information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceInstanceEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get  instance
   * @description Get the information of a specific  instance
   *
   * @param `instanceId` - string
   *
   * @returns DashboardInstanceInstanceGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string) {
    return this._get({
      path: ['dashboard', 'instances', instanceId, 'instance']
    }).transform(mapDashboardInstanceInstanceGetOutput);
  }
}
