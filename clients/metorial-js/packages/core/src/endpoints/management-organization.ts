import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapManagementOrganizationGetOutput,
  mapManagementOrganizationUpdateBody,
  mapManagementOrganizationUpdateOutput,
  type ManagementOrganizationGetOutput,
  type ManagementOrganizationUpdateBody,
  type ManagementOrganizationUpdateOutput
} from '../resources';

/**
 * @name Organization controller
 * @description Read and write organization information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get organization
   * @description Get the current organization information
   *
   * @param
   *
   * @returns ManagementOrganizationGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get() {
    return this._get({
      path: ['organization']
    }).transform(mapManagementOrganizationGetOutput);
  }

  /**
   * @name Update organization
   * @description Update the current organization information
   *
   * @param `body` - ManagementOrganizationUpdateBody
   *
   * @returns ManagementOrganizationUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(body: ManagementOrganizationUpdateBody) {
    return this._patch({
      path: ['organization'],
      body: mapManagementOrganizationUpdateBody.transformTo(body)
    }).transform(mapManagementOrganizationUpdateOutput);
  }
}
