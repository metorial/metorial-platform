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
export class MetorialInstanceEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get  instance
   * @description Get the information of a specific  instance
   *
   * @param
   *
   * @returns DashboardInstanceInstanceGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(): Promise<DashboardInstanceInstanceGetOutput> {
    let path = 'instance';
    return this._get({
      path
    }).transform(mapDashboardInstanceInstanceGetOutput);
  }
}
