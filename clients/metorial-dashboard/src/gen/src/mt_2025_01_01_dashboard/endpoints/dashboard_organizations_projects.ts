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
export class MetorialDashboardOrganizationsProjectsEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List organization projects
   * @description List all organization projects
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsProjectsListQuery
   *
   * @returns DashboardOrganizationsProjectsListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsProjectsListQuery
  ): Promise<DashboardOrganizationsProjectsListOutput> {
    let path = `dashboard/organizations/${organizationId}/projects`;
    return this._get({
      path,

      query: query
        ? mapDashboardOrganizationsProjectsListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsProjectsListOutput);
  }

  /**
   * @name Get organization project
   * @description Get the information of a specific organization project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   *
   * @returns DashboardOrganizationsProjectsGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    projectId: string
  ): Promise<DashboardOrganizationsProjectsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}`;
    return this._get({
      path
    }).transform(mapDashboardOrganizationsProjectsGetOutput);
  }

  /**
   * @name Create organization project
   * @description Create a new organization project
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsProjectsCreateBody
   *
   * @returns DashboardOrganizationsProjectsCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsProjectsCreateBody
  ): Promise<DashboardOrganizationsProjectsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects`;
    return this._post({
      path,
      body: mapDashboardOrganizationsProjectsCreateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsProjectsCreateOutput);
  }

  /**
   * @name Delete organization project
   * @description Remove an organization project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   *
   * @returns DashboardOrganizationsProjectsDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    projectId: string
  ): Promise<DashboardOrganizationsProjectsDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}`;
    return this._delete({
      path
    }).transform(mapDashboardOrganizationsProjectsDeleteOutput);
  }

  /**
   * @name Update organization project
   * @description Update the role of an organization project
   *
   * @param `organizationId` - string
   * @param `projectId` - string
   * @param `body` - DashboardOrganizationsProjectsUpdateBody
   *
   * @returns DashboardOrganizationsProjectsUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    projectId: string,
    body: DashboardOrganizationsProjectsUpdateBody
  ): Promise<DashboardOrganizationsProjectsUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/projects/${projectId}`;
    return this._post({
      path,
      body: mapDashboardOrganizationsProjectsUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsProjectsUpdateOutput);
  }
}
