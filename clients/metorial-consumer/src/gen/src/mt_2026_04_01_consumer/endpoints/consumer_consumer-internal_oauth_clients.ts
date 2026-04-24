import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerConsumerInternalOauthClientsGetOutput,
  type ConsumerConsumerInternalOauthClientsGetOutput
} from '../resources';

/**
 * @name Consumer Providers controller
 * @description Browse and configure portal providers from the consumer side.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerConsumerInternalOauthClientsEndpoint {
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
   * @name Get portal OAuth client
   * @description Returns one portal OAuth client visible to the current portal consumer.
   *
   * @param `portalAuthClientId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerConsumerInternalOauthClientsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    portalAuthClientId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerConsumerInternalOauthClientsGetOutput> {
    let path = `consumer/portal-oauth-clients/${portalAuthClientId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerConsumerInternalOauthClientsGetOutput
    );
  }
}
