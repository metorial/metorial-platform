import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsProjectsCreateBody,
  mapDashboardOrganizationsProjectsCreateOutput,
  mapDashboardOrganizationsProjectsDeleteOutput,
  mapDashboardOrganizationsProjectsGetOutput,
  mapDashboardOrganizationsProjectsListOutput,
  mapDashboardOrganizationsProjectsListQuery,
  mapDashboardOrganizationsProjectsUpdateBody,
  mapDashboardOrganizationsProjectsUpdateOutput,
  type DashboardOrganizationsProjectsCreateBody,
  type DashboardOrganizationsProjectsCreateOutput,
  type DashboardOrganizationsProjectsDeleteOutput,
  type DashboardOrganizationsProjectsGetOutput,
  type DashboardOrganizationsProjectsListOutput,
  type DashboardOrganizationsProjectsListQuery,
  type DashboardOrganizationsProjectsUpdateBody,
  type DashboardOrganizationsProjectsUpdateOutput
} from '../resources';

/**
 * @name Project controller
 * @description Read and write project information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationProjectsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List organization projects
   * @description List all organization projects
   *
   * @param `query` - DashboardOrganizationsProjectsListQuery
   *
   * @returns DashboardOrganizationsProjectsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(query?: DashboardOrganizationsProjectsListQuery) {
    return this._get({
      path: ['organization', 'projects'],

      query: query
        ? mapDashboardOrganizationsProjectsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsProjectsListOutput);
  }

  /**
   * @name Get organization project
   * @description Get the information of a specific organization project
   *
   * @param `projectId` - string
   *
   * @returns DashboardOrganizationsProjectsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(projectId: string) {
    return this._get({
      path: ['organization', 'projects', projectId]
    }).transform(mapDashboardOrganizationsProjectsGetOutput);
  }

  /**
   * @name Create organization project
   * @description Create a new organization project
   *
   * @param `body` - DashboardOrganizationsProjectsCreateBody
   *
   * @returns DashboardOrganizationsProjectsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(body: DashboardOrganizationsProjectsCreateBody) {
    return this._post({
      path: ['organization', 'projects'],
      body: mapDashboardOrganizationsProjectsCreateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsProjectsCreateOutput);
  }

  /**
   * @name Delete organization project
   * @description Remove an organization project
   *
   * @param `projectId` - string
   *
   * @returns DashboardOrganizationsProjectsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(projectId: string) {
    return this._delete({
      path: ['organization', 'projects', projectId]
    }).transform(mapDashboardOrganizationsProjectsDeleteOutput);
  }

  /**
   * @name Update organization project
   * @description Update the role of an organization project
   *
   * @param `projectId` - string
   * @param `body` - DashboardOrganizationsProjectsUpdateBody
   *
   * @returns DashboardOrganizationsProjectsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(projectId: string, body: DashboardOrganizationsProjectsUpdateBody) {
    return this._post({
      path: ['organization', 'projects', projectId],
      body: mapDashboardOrganizationsProjectsUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsProjectsUpdateOutput);
  }
}
