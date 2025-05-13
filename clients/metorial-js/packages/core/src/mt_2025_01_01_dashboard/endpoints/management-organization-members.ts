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
export class MetorialManagementOrganizationMembersEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List organization members
   * @description List all organization members
   *
   * @param `query` - DashboardOrganizationsMembersListQuery
   *
   * @returns DashboardOrganizationsMembersListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardOrganizationsMembersListQuery) {
    return this._get({
      path: ['organization', 'members'],

      query: query
        ? mapDashboardOrganizationsMembersListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsMembersListOutput);
  }

  /**
   * @name Get organization member
   * @description Get the information of a specific organization member
   *
   * @param `memberId` - string
   *
   * @returns DashboardOrganizationsMembersGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(memberId: string) {
    return this._get({
      path: ['organization', 'members', memberId]
    }).transform(mapDashboardOrganizationsMembersGetOutput);
  }

  /**
   * @name Delete organization member
   * @description Remove an organization member
   *
   * @param `memberId` - string
   *
   * @returns DashboardOrganizationsMembersDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(memberId: string) {
    return this._delete({
      path: ['organization', 'members', memberId]
    }).transform(mapDashboardOrganizationsMembersDeleteOutput);
  }

  /**
   * @name Update organization member
   * @description Update the role of an organization member
   *
   * @param `memberId` - string
   * @param `body` - DashboardOrganizationsMembersUpdateBody
   *
   * @returns DashboardOrganizationsMembersUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(memberId: string, body: DashboardOrganizationsMembersUpdateBody) {
    return this._post({
      path: ['organization', 'members', memberId],
      body: mapDashboardOrganizationsMembersUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsMembersUpdateOutput);
  }
}
