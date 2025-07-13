import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapProviderOauthDiscoverBody,
  mapProviderOauthDiscoverOutput,
  type ProviderOauthDiscoverBody,
  type ProviderOauthDiscoverOutput
} from '../resources';

/**
 * @name OAuth Connection Template controller
 * @description Get OAuth connection template information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderOauthEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Discover OAuth Configuration
   * @description Discover OAuth configuration from a discovery URL
   *
   * @param `body` - ProviderOauthDiscoverBody
   *
   * @returns ProviderOauthDiscoverOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  discover(body: ProviderOauthDiscoverBody) {
    return this._post({
      path: ['provider-oauth-discovery'],
      body: mapProviderOauthDiscoverBody.transformTo(body)
    }).transform(mapProviderOauthDiscoverOutput);
  }
}
