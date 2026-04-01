import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapApiKeysRevealOutput,
  mapApiKeysRotateBody,
  mapApiKeysRotateOutput,
  type ApiKeysRevealOutput,
  type ApiKeysRotateBody,
  type ApiKeysRotateOutput
} from '../resources';

/**
 * @name API Key controller
 * @description Read and write API key information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialApiKeysEndpoint {
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
   * @name Rotate API key
   * @description Rotate a specific API key
   *
   * @param `organizationId` - string
   * @param `apiKeyId` - string
   * @param `body` - ApiKeysRotateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ApiKeysRotateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rotate(
    organizationId: string,
    apiKeyId: string,
    body: ApiKeysRotateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ApiKeysRotateOutput> {
    let path = `dashboard/organizations/${organizationId}/api-keys/${apiKeyId}/rotate`;

    let request = {
      path,
      body: mapApiKeysRotateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapApiKeysRotateOutput);
  }

  /**
   * @name Reveal API key
   * @description Reveal a specific API key
   *
   * @param `organizationId` - string
   * @param `apiKeyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ApiKeysRevealOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reveal(
    organizationId: string,
    apiKeyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ApiKeysRevealOutput> {
    let path = `dashboard/organizations/${organizationId}/api-keys/${apiKeyId}/reveal`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapApiKeysRevealOutput);
  }
}
