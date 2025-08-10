import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapApiKeysCreateBody,
  mapApiKeysCreateOutput,
  mapApiKeysGetOutput,
  mapApiKeysListOutput,
  mapApiKeysListQuery,
  mapApiKeysRevealOutput,
  mapApiKeysRevokeOutput,
  mapApiKeysRotateBody,
  mapApiKeysRotateOutput,
  mapApiKeysUpdateBody,
  mapApiKeysUpdateOutput,
  type ApiKeysCreateBody,
  type ApiKeysCreateOutput,
  type ApiKeysGetOutput,
  type ApiKeysListOutput,
  type ApiKeysListQuery,
  type ApiKeysRevealOutput,
  type ApiKeysRevokeOutput,
  type ApiKeysRotateBody,
  type ApiKeysRotateOutput,
  type ApiKeysUpdateBody,
  type ApiKeysUpdateOutput
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
   * @name Get user
   * @description Get the current user information
   *
   * @param `organizationId` - string
   * @param `query` - ApiKeysListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ApiKeysListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: ApiKeysListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ApiKeysListOutput> {
    let path = `dashboard/organizations/${organizationId}/api-keys`;

    let request = {
      path,

      query: query ? mapApiKeysListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapApiKeysListOutput);
  }

  /**
   * @name Get API key
   * @description Get the information of a specific API key
   *
   * @param `organizationId` - string
   * @param `apiKeyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ApiKeysGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    apiKeyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ApiKeysGetOutput> {
    let path = `dashboard/organizations/${organizationId}/api-keys/${apiKeyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapApiKeysGetOutput);
  }

  /**
   * @name Create API key
   * @description Create a new API key
   *
   * @param `organizationId` - string
   * @param `body` - ApiKeysCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ApiKeysCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: ApiKeysCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ApiKeysCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/api-keys`;

    let request = {
      path,
      body: mapApiKeysCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapApiKeysCreateOutput);
  }

  /**
   * @name Update API key
   * @description Update the information of a specific API key
   *
   * @param `organizationId` - string
   * @param `apiKeyId` - string
   * @param `body` - ApiKeysUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ApiKeysUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    apiKeyId: string,
    body: ApiKeysUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ApiKeysUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/api-keys/${apiKeyId}`;

    let request = {
      path,
      body: mapApiKeysUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapApiKeysUpdateOutput);
  }

  /**
   * @name Revoke API key
   * @description Revoke a specific API key
   *
   * @param `organizationId` - string
   * @param `apiKeyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ApiKeysRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    organizationId: string,
    apiKeyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ApiKeysRevokeOutput> {
    let path = `dashboard/organizations/${organizationId}/api-keys/${apiKeyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapApiKeysRevokeOutput);
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
