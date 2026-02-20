import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapOrganizationsProfileGetOutput,
  mapOrganizationsProfileUpdateBody,
  mapOrganizationsProfileUpdateOutput,
  type OrganizationsProfileGetOutput,
  type OrganizationsProfileUpdateBody,
  type OrganizationsProfileUpdateOutput
} from '../resources';

/**
 * @name Profile controller
 * @description Get and manage profile information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialOrganizationsProfileEndpoint {
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
   * @name Get own profile
   * @description Get the profile for the current organization
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns OrganizationsProfileGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<OrganizationsProfileGetOutput> {
    let path = `dashboard/organizations/${organizationId}/profile`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapOrganizationsProfileGetOutput);
  }

  /**
   * @name Update own profile
   * @description Update the profile for the current organization
   *
   * @param `organizationId` - string
   * @param `body` - OrganizationsProfileUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns OrganizationsProfileUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    body: OrganizationsProfileUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<OrganizationsProfileUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/profile`;

    let request = {
      path,
      body: mapOrganizationsProfileUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapOrganizationsProfileUpdateOutput);
  }
}
