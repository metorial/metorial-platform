import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsCreateBody,
  mapDashboardOrganizationsCreateOutput,
  mapDashboardOrganizationsDeleteOutput,
  mapDashboardOrganizationsGetMembershipOutput,
  mapDashboardOrganizationsGetOutput,
  mapDashboardOrganizationsListOutput,
  mapDashboardOrganizationsListQuery,
  mapDashboardOrganizationsUpdateBody,
  mapDashboardOrganizationsUpdateOutput,
  type DashboardOrganizationsCreateBody,
  type DashboardOrganizationsCreateOutput,
  type DashboardOrganizationsDeleteOutput,
  type DashboardOrganizationsGetMembershipOutput,
  type DashboardOrganizationsGetOutput,
  type DashboardOrganizationsListOutput,
  type DashboardOrganizationsListQuery,
  type DashboardOrganizationsUpdateBody,
  type DashboardOrganizationsUpdateOutput
} from '../resources';

/**
 * @name Organization controller
 * @description Read and write organization information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Create organization
   * @description Create a new organization
   *
   * @param `body` - DashboardOrganizationsCreateBody
   *
   * @returns DashboardOrganizationsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(body: DashboardOrganizationsCreateBody) {
    return this._post({
      path: ['dashboard', 'organizations'],
      body: mapDashboardOrganizationsCreateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsCreateOutput);
  }

  /**
   * @name List organizations
   * @description List all organizations
   *
   * @param `query` - DashboardOrganizationsListQuery
   *
   * @returns DashboardOrganizationsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardOrganizationsListQuery) {
    return this._get({
      path: ['dashboard', 'organizations'],

      query: query
        ? mapDashboardOrganizationsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsListOutput);
  }

  /**
   * @name Get organization
   * @description Get the current organization information
   *
   * @param `organizationId` - string
   *
   * @returns DashboardOrganizationsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(organizationId: string) {
    return this._get({
      path: ['dashboard', 'organizations', organizationId]
    }).transform(mapDashboardOrganizationsGetOutput);
  }

  /**
   * @name Update organization
   * @description Update the current organization information
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsUpdateBody
   *
   * @returns DashboardOrganizationsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(organizationId: string, body: DashboardOrganizationsUpdateBody) {
    return this._patch({
      path: ['dashboard', 'organizations', organizationId],
      body: mapDashboardOrganizationsUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsUpdateOutput);
  }

  /**
   * @name Delete organization
   * @description Delete the current organization
   *
   * @param `organizationId` - string
   *
   * @returns DashboardOrganizationsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(organizationId: string) {
    return this._delete({
      path: ['dashboard', 'organizations', organizationId]
    }).transform(mapDashboardOrganizationsDeleteOutput);
  }

  /**
   * @name Get organization
   * @description Get the current organization information
   *
   * @param `organizationId` - string
   *
   * @returns DashboardOrganizationsGetMembershipOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getMembership(organizationId: string) {
    return this._get({
      path: ['dashboard', 'organizations', organizationId, 'membership']
    }).transform(mapDashboardOrganizationsGetMembershipOutput);
  }
}
