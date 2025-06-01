import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapManagementUserDeleteBody,
  mapManagementUserDeleteOutput,
  mapManagementUserGetOutput,
  mapManagementUserUpdateBody,
  mapManagementUserUpdateOutput,
  type ManagementUserDeleteBody,
  type ManagementUserDeleteOutput,
  type ManagementUserGetOutput,
  type ManagementUserUpdateBody,
  type ManagementUserUpdateOutput
} from '../resources';

/**
 * @name User controller
 * @description Read and write user information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementUserEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get user
   * @description Get the current user information
   *
   * @param
   *
   * @returns ManagementUserGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get() {
    return this._get({
      path: ['user']
    }).transform(mapManagementUserGetOutput);
  }

  /**
   * @name Update user
   * @description Update the current user information
   *
   * @param `body` - ManagementUserUpdateBody
   *
   * @returns ManagementUserUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(body: ManagementUserUpdateBody) {
    return this._post({
      path: ['user'],
      body: mapManagementUserUpdateBody.transformTo(body)
    }).transform(mapManagementUserUpdateOutput);
  }

  /**
   * @name Update user
   * @description Update the current user information
   *
   * @param `body` - ManagementUserDeleteBody
   *
   * @returns ManagementUserDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(body: ManagementUserDeleteBody) {
    return this._post({
      path: ['user'],
      body: mapManagementUserDeleteBody.transformTo(body)
    }).transform(mapManagementUserDeleteOutput);
  }
}
