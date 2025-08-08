import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardBootBody,
  mapDashboardBootOutput,
  type DashboardBootBody,
  type DashboardBootOutput
} from '../resources';

/**
 * @name Boot controller
 * @description Boot user
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Create organization
   * @description Create a new organization
   *
   * @param `body` - DashboardBootBody
   *
   * @returns DashboardBootOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  boot(body: DashboardBootBody): Promise<DashboardBootOutput> {
    let path = 'dashboard/boot';
    return this._post({
      path,
      body: mapDashboardBootBody.transformTo(body)
    }).transform(mapDashboardBootOutput);
  }
}
