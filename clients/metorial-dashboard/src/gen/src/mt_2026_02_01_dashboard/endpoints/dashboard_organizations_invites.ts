import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsInvitesCreateBody,
  mapDashboardOrganizationsInvitesCreateOutput,
  mapDashboardOrganizationsInvitesDeleteOutput,
  mapDashboardOrganizationsInvitesEnsureLinkOutput,
  mapDashboardOrganizationsInvitesGetOutput,
  mapDashboardOrganizationsInvitesListOutput,
  mapDashboardOrganizationsInvitesListQuery,
  mapDashboardOrganizationsInvitesUpdateBody,
  mapDashboardOrganizationsInvitesUpdateOutput,
  type DashboardOrganizationsInvitesCreateBody,
  type DashboardOrganizationsInvitesCreateOutput,
  type DashboardOrganizationsInvitesDeleteOutput,
  type DashboardOrganizationsInvitesEnsureLinkOutput,
  type DashboardOrganizationsInvitesGetOutput,
  type DashboardOrganizationsInvitesListOutput,
  type DashboardOrganizationsInvitesListQuery,
  type DashboardOrganizationsInvitesUpdateBody,
  type DashboardOrganizationsInvitesUpdateOutput
} from '../resources';

/**
 * @name Organization Invite controller
 * @description Read and write organization invite information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsInvitesEndpoint {
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
   * @name List organization invites
   * @description List all organization invites
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsInvitesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInvitesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsInvitesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInvitesListOutput> {
    let path = `dashboard/organizations/${organizationId}/invites`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsInvitesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsInvitesListOutput
    );
  }

  /**
   * @name Get organization invite
   * @description Get the information of a specific organization invite
   *
   * @param `organizationId` - string
   * @param `inviteId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInvitesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    inviteId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInvitesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/invites/${inviteId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsInvitesGetOutput
    );
  }

  /**
   * @name Create organization invite
   * @description Create a new organization invite
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsInvitesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInvitesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsInvitesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInvitesCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/invites`;

    let request = {
      path,
      body: mapDashboardOrganizationsInvitesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsInvitesCreateOutput
    );
  }

  /**
   * @name Ensure organization invite link
   * @description Ensure the invite link for the organization
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInvitesEnsureLinkOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  ensureLink(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInvitesEnsureLinkOutput> {
    let path = `dashboard/organizations/${organizationId}/invites/ensure`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsInvitesEnsureLinkOutput
    );
  }

  /**
   * @name Delete organization invite
   * @description Remove an organization invite
   *
   * @param `organizationId` - string
   * @param `inviteId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInvitesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    inviteId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInvitesDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/invites/${inviteId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsInvitesDeleteOutput
    );
  }

  /**
   * @name Update organization invite
   * @description Update the role of an organization invite
   *
   * @param `organizationId` - string
   * @param `inviteId` - string
   * @param `body` - DashboardOrganizationsInvitesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsInvitesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    inviteId: string,
    body: DashboardOrganizationsInvitesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsInvitesUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/invites/${inviteId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsInvitesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsInvitesUpdateOutput
    );
  }
}
