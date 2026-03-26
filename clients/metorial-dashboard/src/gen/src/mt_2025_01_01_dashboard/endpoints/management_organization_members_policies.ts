import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsMembersPoliciesCreateBody,
  mapDashboardOrganizationsMembersPoliciesCreateOutput,
  mapDashboardOrganizationsMembersPoliciesDeleteOutput,
  type DashboardOrganizationsMembersPoliciesCreateBody,
  type DashboardOrganizationsMembersPoliciesCreateOutput,
  type DashboardOrganizationsMembersPoliciesDeleteOutput
} from '../resources';

/**
 * @name Organization Member controller
 * @description Read and write organization member information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationMembersPoliciesEndpoint {
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
   * @name Assign policy to organization member
   * @description Assign an access policy to an organization member
   *
   * @param `memberId` - string
   * @param `body` - DashboardOrganizationsMembersPoliciesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsMembersPoliciesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    memberId: string,
    body: DashboardOrganizationsMembersPoliciesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsMembersPoliciesCreateOutput> {
    let path = `organization/members/${memberId}/policies`;

    let request = {
      path,
      body: mapDashboardOrganizationsMembersPoliciesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsMembersPoliciesCreateOutput
    );
  }

  /**
   * @name Remove policy from organization member
   * @description Remove an access policy from an organization member
   *
   * @param `memberId` - string
   * @param `accessPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsMembersPoliciesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    memberId: string,
    accessPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsMembersPoliciesDeleteOutput> {
    let path = `organization/members/${memberId}/policies/${accessPolicyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsMembersPoliciesDeleteOutput
    );
  }
}
