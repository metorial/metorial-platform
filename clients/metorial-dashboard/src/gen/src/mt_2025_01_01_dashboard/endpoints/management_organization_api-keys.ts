import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsApiKeysCreateBody,
  mapDashboardOrganizationsApiKeysCreateOutput,
  mapDashboardOrganizationsApiKeysGetOutput,
  mapDashboardOrganizationsApiKeysListOutput,
  mapDashboardOrganizationsApiKeysListQuery,
  mapDashboardOrganizationsApiKeysRevealOutput,
  mapDashboardOrganizationsApiKeysRevokeOutput,
  mapDashboardOrganizationsApiKeysRotateBody,
  mapDashboardOrganizationsApiKeysRotateOutput,
  mapDashboardOrganizationsApiKeysUpdateBody,
  mapDashboardOrganizationsApiKeysUpdateOutput,
  type DashboardOrganizationsApiKeysCreateBody,
  type DashboardOrganizationsApiKeysCreateOutput,
  type DashboardOrganizationsApiKeysGetOutput,
  type DashboardOrganizationsApiKeysListOutput,
  type DashboardOrganizationsApiKeysListQuery,
  type DashboardOrganizationsApiKeysRevealOutput,
  type DashboardOrganizationsApiKeysRevokeOutput,
  type DashboardOrganizationsApiKeysRotateBody,
  type DashboardOrganizationsApiKeysRotateOutput,
  type DashboardOrganizationsApiKeysUpdateBody,
  type DashboardOrganizationsApiKeysUpdateOutput
} from '../resources';

/**
 * @name API Key controller
 * @description Read and write API key information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationApiKeysEndpoint {
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
   * @param `query` - DashboardOrganizationsApiKeysListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsApiKeysListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsApiKeysListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsApiKeysListOutput> {
    let path = 'organization/api-keys';

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsApiKeysListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsApiKeysListOutput
    );
  }

  /**
   * @name Get API key
   * @description Get the information of a specific API key
   *
   * @param `apiKeyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsApiKeysGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    apiKeyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsApiKeysGetOutput> {
    let path = `organization/api-keys/${apiKeyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsApiKeysGetOutput
    );
  }

  /**
   * @name Create API key
   * @description Create a new API key
   *
   * @param `body` - DashboardOrganizationsApiKeysCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsApiKeysCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsApiKeysCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsApiKeysCreateOutput> {
    let path = 'organization/api-keys';

    let request = {
      path,
      body: mapDashboardOrganizationsApiKeysCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsApiKeysCreateOutput
    );
  }

  /**
   * @name Update API key
   * @description Update the information of a specific API key
   *
   * @param `apiKeyId` - string
   * @param `body` - DashboardOrganizationsApiKeysUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsApiKeysUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    apiKeyId: string,
    body: DashboardOrganizationsApiKeysUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsApiKeysUpdateOutput> {
    let path = `organization/api-keys/${apiKeyId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsApiKeysUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsApiKeysUpdateOutput
    );
  }

  /**
   * @name Revoke API key
   * @description Revoke a specific API key
   *
   * @param `apiKeyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsApiKeysRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    apiKeyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsApiKeysRevokeOutput> {
    let path = `organization/api-keys/${apiKeyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsApiKeysRevokeOutput
    );
  }

  /**
   * @name Rotate API key
   * @description Rotate a specific API key
   *
   * @param `apiKeyId` - string
   * @param `body` - DashboardOrganizationsApiKeysRotateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsApiKeysRotateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rotate(
    apiKeyId: string,
    body: DashboardOrganizationsApiKeysRotateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsApiKeysRotateOutput> {
    let path = `organization/api-keys/${apiKeyId}/rotate`;

    let request = {
      path,
      body: mapDashboardOrganizationsApiKeysRotateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsApiKeysRotateOutput
    );
  }

  /**
   * @name Reveal API key
   * @description Reveal a specific API key
   *
   * @param `apiKeyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsApiKeysRevealOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reveal(
    apiKeyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsApiKeysRevealOutput> {
    let path = `organization/api-keys/${apiKeyId}/reveal`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsApiKeysRevealOutput
    );
  }
}
