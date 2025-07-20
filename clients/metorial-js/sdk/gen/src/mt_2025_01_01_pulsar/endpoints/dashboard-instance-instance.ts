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
 * @description Instances are independent environments within Metorial, each with its own configuration and data. Each instance is a port of a Metorial project. You can for example create production, staging, and development instances for your project.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceInstanceEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get instance details
   * @description Retrieves metadata and configuration details for a specific instance.
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
