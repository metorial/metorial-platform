import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOauthScopesListOutput,
  type DashboardOrganizationsOauthScopesListOutput
} from '../resources';

/**
 * @name OAuth Scope controller
 * @description Read all OAuth scopes that can be requested by organization applications
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationOauthScopesEndpoint {
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
   * @name List OAuth scopes
   * @description Returns all available OAuth scopes that organization-owned OAuth applications may request.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthScopesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(opts?: {
    headers?: Record<string, string>;
  }): Promise<DashboardOrganizationsOauthScopesListOutput> {
    let path = 'organization/oauth/scopes';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsOauthScopesListOutput
    );
  }
}
