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
 * @description Endpoint for retrieving information about a specific instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialInstanceEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get instance details
   * @description Retrieves metadata and configuration details for a specific instance.
   *
   * @param
   *
   * @returns DashboardInstanceInstanceGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get() {
    return this._get({
      path: ['instance']
    }).transform(mapDashboardInstanceInstanceGetOutput);
  }
}
