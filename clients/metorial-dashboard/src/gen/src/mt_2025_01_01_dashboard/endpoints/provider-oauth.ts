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
export class MetorialProviderOauthEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name Discover OAuth Configuration
   * @description Discover OAuth configuration from a discovery URL
   *
   * @param `body` - ProviderOauthDiscoverBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ProviderOauthDiscoverOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  discover(
    body: ProviderOauthDiscoverBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ProviderOauthDiscoverOutput> {
    let path = 'provider-oauth-discovery';

    let request = {
      path,
      body: mapProviderOauthDiscoverBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapProviderOauthDiscoverOutput);
  }
}
