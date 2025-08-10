import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapManagementOrganizationGetOutput,
  mapManagementOrganizationUpdateBody,
  mapManagementOrganizationUpdateOutput,
  type ManagementOrganizationGetOutput,
  type ManagementOrganizationUpdateBody,
  type ManagementOrganizationUpdateOutput
} from '../resources';

/**
 * @name Organization controller
 * @description Read and write organization information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationEndpoint {
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
   * @name Get organization
   * @description Get the current organization information
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementOrganizationGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<ManagementOrganizationGetOutput> {
    let path = 'organization';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapManagementOrganizationGetOutput);
  }

  /**
   * @name Update organization
   * @description Update the current organization information
   *
   * @param `body` - ManagementOrganizationUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementOrganizationUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    body: ManagementOrganizationUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementOrganizationUpdateOutput> {
    let path = 'organization';

    let request = {
      path,
      body: mapManagementOrganizationUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapManagementOrganizationUpdateOutput
    );
  }
}
