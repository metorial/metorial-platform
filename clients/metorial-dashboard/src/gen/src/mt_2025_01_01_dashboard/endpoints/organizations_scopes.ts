import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapOrganizationsScopesGetOutput,
  type OrganizationsScopesGetOutput
} from '../resources';

/**
 * @name Scopes controller
 * @description Read the current member's effective scopes for this organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialOrganizationsScopesEndpoint {
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
   * @name Get my organization scopes
   * @description Get the effective scopes the current dashboard member has for this organization
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns OrganizationsScopesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<OrganizationsScopesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/scopes`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapOrganizationsScopesGetOutput);
  }
}
