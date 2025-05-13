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
export class MetorialDashboardOrganizationsInvitesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List organization invites
   * @description List all organization invites
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsInvitesListQuery
   *
   * @returns DashboardOrganizationsInvitesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(organizationId: string, query?: DashboardOrganizationsInvitesListQuery) {
    return this._get({
      path: ['dashboard', 'organizations', organizationId, 'invites'],

      query: query
        ? mapDashboardOrganizationsInvitesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsInvitesListOutput);
  }

  /**
   * @name Get organization invite
   * @description Get the information of a specific organization invite
   *
   * @param `organizationId` - string
   * @param `inviteId` - string
   *
   * @returns DashboardOrganizationsInvitesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(organizationId: string, inviteId: string) {
    return this._get({
      path: ['dashboard', 'organizations', organizationId, 'invites', inviteId]
    }).transform(mapDashboardOrganizationsInvitesGetOutput);
  }

  /**
   * @name Create organization invite
   * @description Create a new organization invite
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsInvitesCreateBody
   *
   * @returns DashboardOrganizationsInvitesCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsInvitesCreateBody
  ) {
    return this._post({
      path: ['dashboard', 'organizations', organizationId, 'invites'],
      body: mapDashboardOrganizationsInvitesCreateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsInvitesCreateOutput);
  }

  /**
   * @name Ensure organization invite link
   * @description Ensure the invite link for the organization
   *
   * @param `organizationId` - string
   *
   * @returns DashboardOrganizationsInvitesEnsureLinkOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  ensureLink(organizationId: string) {
    return this._post({
      path: ['dashboard', 'organizations', organizationId, 'invites', 'ensure']
    }).transform(mapDashboardOrganizationsInvitesEnsureLinkOutput);
  }

  /**
   * @name Delete organization invite
   * @description Remove an organization invite
   *
   * @param `organizationId` - string
   * @param `inviteId` - string
   *
   * @returns DashboardOrganizationsInvitesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(organizationId: string, inviteId: string) {
    return this._delete({
      path: ['dashboard', 'organizations', organizationId, 'invites', inviteId]
    }).transform(mapDashboardOrganizationsInvitesDeleteOutput);
  }

  /**
   * @name Update organization invite
   * @description Update the role of an organization invite
   *
   * @param `organizationId` - string
   * @param `inviteId` - string
   * @param `body` - DashboardOrganizationsInvitesUpdateBody
   *
   * @returns DashboardOrganizationsInvitesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    inviteId: string,
    body: DashboardOrganizationsInvitesUpdateBody
  ) {
    return this._post({
      path: ['dashboard', 'organizations', organizationId, 'invites', inviteId],
      body: mapDashboardOrganizationsInvitesUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsInvitesUpdateOutput);
  }
}
