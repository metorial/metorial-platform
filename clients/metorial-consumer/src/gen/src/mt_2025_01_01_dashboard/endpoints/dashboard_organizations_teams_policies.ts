import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsTeamsPoliciesCreateBody,
  mapDashboardOrganizationsTeamsPoliciesCreateOutput,
  mapDashboardOrganizationsTeamsPoliciesDeleteOutput,
  type DashboardOrganizationsTeamsPoliciesCreateBody,
  type DashboardOrganizationsTeamsPoliciesCreateOutput,
  type DashboardOrganizationsTeamsPoliciesDeleteOutput
} from '../resources';

/**
 * @name Organization Team controller
 * @description Read and write team information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsTeamsPoliciesEndpoint {
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
   * @name Assign policy to team
   * @description Assign an access policy to a team
   *
   * @param `organizationId` - string
   * @param `teamId` - string
   * @param `body` - DashboardOrganizationsTeamsPoliciesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsPoliciesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    teamId: string,
    body: DashboardOrganizationsTeamsPoliciesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsPoliciesCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/teams/${teamId}/policies`;

    let request = {
      path,
      body: mapDashboardOrganizationsTeamsPoliciesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsTeamsPoliciesCreateOutput
    );
  }

  /**
   * @name Remove policy from team
   * @description Remove an access policy from a team
   *
   * @param `organizationId` - string
   * @param `teamId` - string
   * @param `accessPolicyId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsTeamsPoliciesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    teamId: string,
    accessPolicyId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsTeamsPoliciesDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/teams/${teamId}/policies/${accessPolicyId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsTeamsPoliciesDeleteOutput
    );
  }
}
