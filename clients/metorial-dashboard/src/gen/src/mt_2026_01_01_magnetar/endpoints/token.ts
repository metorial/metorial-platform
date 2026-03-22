import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import { mapTokenGetOutput, type TokenGetOutput } from '../resources';

/**
 * @name Token controller
 * @description Endpoint for retrieving metadata about the token used for authentication. This is useful for clients to understand the type and capabilities of the token they are using, especially since Metorial supports multiple token types with different permission models.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialTokenEndpoint {
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
   * @name Get token details
   * @description Retrieves metadata and configuration details for a specific token.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns TokenGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: { headers?: Record<string, string> }): Promise<TokenGetOutput> {
    let path = 'token';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapTokenGetOutput);
  }
}
