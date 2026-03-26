import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsServiceAccountsPoliciesCreateBody,
  mapDashboardOrganizationsServiceAccountsPoliciesCreateOutput,
  mapDashboardOrganizationsServiceAccountsPoliciesDeleteOutput,
  type DashboardOrganizationsServiceAccountsPoliciesCreateBody,
  type DashboardOrganizationsServiceAccountsPoliciesCreateOutput,
  type DashboardOrganizationsServiceAccountsPoliciesDeleteOutput
} from '../resources';

/**
 * @name Service Account controller
 * @description Create and manage service accounts for an organization
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsServiceAccountsPoliciesEndpoint {
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
   * @name Assign service account policy
   * @description Assign an access policy to a service account
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `body` - DashboardOrganizationsServiceAccountsPoliciesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsPoliciesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    serviceAccountId: string,
    body: DashboardOrganizationsServiceAccountsPoliciesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsPoliciesCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}/policies`;

    let request = {
      path,
      body: mapDashboardOrganizationsServiceAccountsPoliciesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsServiceAccountsPoliciesCreateOutput
    );
  }

  /**
   * @name Remove service account policy
   * @description Remove an access policy from a service account
   *
   * @param `organizationId` - string
   * @param `serviceAccountId` - string
   * @param `accessPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsServiceAccountsPoliciesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    serviceAccountId: string,
    accessPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsServiceAccountsPoliciesDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/service-accounts/${serviceAccountId}/policies/${accessPolicyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsServiceAccountsPoliciesDeleteOutput
    );
  }
}
