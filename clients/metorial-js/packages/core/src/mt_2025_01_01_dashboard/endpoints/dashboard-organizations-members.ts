import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsMembersDeleteOutput,
  mapDashboardOrganizationsMembersGetOutput,
  mapDashboardOrganizationsMembersListOutput,
  mapDashboardOrganizationsMembersListQuery,
  mapDashboardOrganizationsMembersUpdateBody,
  mapDashboardOrganizationsMembersUpdateOutput,
  type DashboardOrganizationsMembersDeleteOutput,
  type DashboardOrganizationsMembersGetOutput,
  type DashboardOrganizationsMembersListOutput,
  type DashboardOrganizationsMembersListQuery,
  type DashboardOrganizationsMembersUpdateBody,
  type DashboardOrganizationsMembersUpdateOutput
} from '../resources';

/**
 * @name Organization Member controller
 * @description Read and write organization member information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsMembersEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List organization members
   * @description List all organization members
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsMembersListQuery
   *
   * @returns DashboardOrganizationsMembersListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(organizationId: string, query?: DashboardOrganizationsMembersListQuery) {
    return this._get({
      path: ['dashboard', 'organizations', organizationId, 'members'],

      query: query
        ? mapDashboardOrganizationsMembersListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsMembersListOutput);
  }

  /**
   * @name Get organization member
   * @description Get the information of a specific organization member
   *
   * @param `organizationId` - string
   * @param `memberId` - string
   *
   * @returns DashboardOrganizationsMembersGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(organizationId: string, memberId: string) {
    return this._get({
      path: ['dashboard', 'organizations', organizationId, 'members', memberId]
    }).transform(mapDashboardOrganizationsMembersGetOutput);
  }

  /**
   * @name Delete organization member
   * @description Remove an organization member
   *
   * @param `organizationId` - string
   * @param `memberId` - string
   *
   * @returns DashboardOrganizationsMembersDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(organizationId: string, memberId: string) {
    return this._delete({
      path: ['dashboard', 'organizations', organizationId, 'members', memberId]
    }).transform(mapDashboardOrganizationsMembersDeleteOutput);
  }

  /**
   * @name Update organization member
   * @description Update the role of an organization member
   *
   * @param `organizationId` - string
   * @param `memberId` - string
   * @param `body` - DashboardOrganizationsMembersUpdateBody
   *
   * @returns DashboardOrganizationsMembersUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    memberId: string,
    body: DashboardOrganizationsMembersUpdateBody
  ) {
    return this._post({
      path: ['dashboard', 'organizations', organizationId, 'members', memberId],
      body: mapDashboardOrganizationsMembersUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsMembersUpdateOutput);
  }
}
