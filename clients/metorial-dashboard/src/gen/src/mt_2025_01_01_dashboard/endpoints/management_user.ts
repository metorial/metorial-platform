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
export class MetorialManagementUserEndpoint {
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
   * @name Get user
   * @description Get the current user information
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementUserGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<ManagementUserGetOutput> {
    let path = 'user';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapManagementUserGetOutput);
  }

  /**
   * @name Update user
   * @description Update the current user information
   *
   * @param `body` - ManagementUserUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementUserUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    body: ManagementUserUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementUserUpdateOutput> {
    let path = 'user';

    let request = {
      path,
      body: mapManagementUserUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapManagementUserUpdateOutput);
  }

  /**
   * @name Update user
   * @description Update the current user information
   *
   * @param `body` - ManagementUserDeleteBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementUserDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    body: ManagementUserDeleteBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementUserDeleteOutput> {
    let path = 'user';

    let request = {
      path,
      body: mapManagementUserDeleteBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapManagementUserDeleteOutput);
  }
}
