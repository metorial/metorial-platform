import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsOauthAppsClientSecretsCreateOutput,
  mapDashboardOrganizationsOauthAppsClientSecretsDeleteOutput,
  type DashboardOrganizationsOauthAppsClientSecretsCreateOutput,
  type DashboardOrganizationsOauthAppsClientSecretsDeleteOutput
} from '../resources';

/**
 * @name OAuth Application controller
 * @description Create and manage OAuth applications for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationOauthAppsClientSecretsEndpoint {
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
   * @name Create OAuth application client secret
   * @description Creates a new client secret for an OAuth application.
   *
   * @param `oauthApplicationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAppsClientSecretsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    oauthApplicationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAppsClientSecretsCreateOutput> {
    let path = `organization/oauth/apps/${oauthApplicationId}/client-secrets`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsOauthAppsClientSecretsCreateOutput
    );
  }

  /**
   * @name Delete OAuth application client secret
   * @description Deletes a client secret from an OAuth application.
   *
   * @param `oauthApplicationId` - string
   * @param `oauthApplicationClientSecretId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsOauthAppsClientSecretsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    oauthApplicationId: string,
    oauthApplicationClientSecretId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsOauthAppsClientSecretsDeleteOutput> {
    let path = `organization/oauth/apps/${oauthApplicationId}/client-secrets/${oauthApplicationClientSecretId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsOauthAppsClientSecretsDeleteOutput
    );
  }
}
