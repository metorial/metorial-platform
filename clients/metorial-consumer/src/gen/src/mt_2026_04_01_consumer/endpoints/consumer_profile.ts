import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerProfileGetOutput,
  type ConsumerProfileGetOutput
} from '../resources';

/**
 * @name Consumer Session controller
 * @description Inspect the authenticated consumer session and profile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerProfileEndpoint {
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
   * @name Get consumer profile
   * @description Returns the authenticated consumer profile.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProfileGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<ConsumerProfileGetOutput> {
    let path = 'consumer/profile';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerProfileGetOutput);
  }
}
