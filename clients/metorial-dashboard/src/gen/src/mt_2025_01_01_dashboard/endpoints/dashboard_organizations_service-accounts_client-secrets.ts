import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsServiceAccountsClientSecretsCreateOutput,
  mapDashboardOrganizationsServiceAccountsClientSecretsDeleteOutput,
  type DashboardOrganizationsServiceAccountsClientSecretsCreateOutput,
  type DashboardOrganizationsServiceAccountsClientSecretsDeleteOutput
} from '../resources';

/**
 * @name Service Account controller
 * @description Create and manage service accounts for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsServiceAccountsClientSecretsEndpoint {
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
   * @name Create service account client secret
   * @description Creates a new client secret for a service account.
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsClientSecretsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    serviceAccountId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsClientSecretsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}/client-secrets`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsServiceAccountsClientSecretsCreateOutput
    );
  }

  /**
   * @name Delete service account client secret
   * @description Deletes a client secret from a service account.
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `oauthApplicationClientSecretId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsClientSecretsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    serviceAccountId: string,
    oauthApplicationClientSecretId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsClientSecretsDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}/client-secrets/${oauthApplicationClientSecretId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsServiceAccountsClientSecretsDeleteOutput
    );
  }
}
