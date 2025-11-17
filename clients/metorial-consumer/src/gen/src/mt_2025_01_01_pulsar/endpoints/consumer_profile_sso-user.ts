import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerProfileSsoUserGetOutput,
  type ConsumerProfileSsoUserGetOutput
} from '../resources';

/**
 * @name Consumer Session controller
 * @description
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerProfileSsoUserEndpoint {
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
   * @name
   * @description
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProfileSsoUserGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<ConsumerProfileSsoUserGetOutput> {
    let path = 'consumer/profile/sso-user';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerProfileSsoUserGetOutput);
  }
}
