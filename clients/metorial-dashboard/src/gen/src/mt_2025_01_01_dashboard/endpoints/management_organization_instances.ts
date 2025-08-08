import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsInstancesCreateBody,
  mapDashboardOrganizationsInstancesCreateOutput,
  mapDashboardOrganizationsInstancesDeleteOutput,
  mapDashboardOrganizationsInstancesGetOutput,
  mapDashboardOrganizationsInstancesListOutput,
  mapDashboardOrganizationsInstancesListQuery,
  mapDashboardOrganizationsInstancesUpdateBody,
  mapDashboardOrganizationsInstancesUpdateOutput,
  type DashboardOrganizationsInstancesCreateBody,
  type DashboardOrganizationsInstancesCreateOutput,
  type DashboardOrganizationsInstancesDeleteOutput,
  type DashboardOrganizationsInstancesGetOutput,
  type DashboardOrganizationsInstancesListOutput,
  type DashboardOrganizationsInstancesListQuery,
  type DashboardOrganizationsInstancesUpdateBody,
  type DashboardOrganizationsInstancesUpdateOutput
} from '../resources';

/**
 * @name Instance controller
 * @description Read and write instance information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationInstancesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List organization instances
   * @description List all organization instances
   *
   * @param `query` - DashboardOrganizationsInstancesListQuery
   *
   * @returns DashboardOrganizationsInstancesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardOrganizationsInstancesListQuery
  ): Promise<DashboardOrganizationsInstancesListOutput> {
    let path = 'organization/instances';
    return this._get({
      path,

      query: query
        ? mapDashboardOrganizationsInstancesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsInstancesListOutput);
  }

  /**
   * @name Get organization instance
   * @description Get the information of a specific organization instance
   *
   * @param `instanceId` - string
   *
   * @returns DashboardOrganizationsInstancesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(instanceId: string): Promise<DashboardOrganizationsInstancesGetOutput> {
    let path = `organization/instances/${instanceId}`;
    return this._get({
      path
    }).transform(mapDashboardOrganizationsInstancesGetOutput);
  }

  /**
   * @name Create organization instance
   * @description Create a new organization instance
   *
   * @param `body` - DashboardOrganizationsInstancesCreateBody
   *
   * @returns DashboardOrganizationsInstancesCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardOrganizationsInstancesCreateBody
  ): Promise<DashboardOrganizationsInstancesCreateOutput> {
    let path = 'organization/instances';
    return this._post({
      path,
      body: mapDashboardOrganizationsInstancesCreateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsInstancesCreateOutput);
  }

  /**
   * @name Delete organization instance
   * @description Remove an organization instance
   *
   * @param `instanceId` - string
   *
   * @returns DashboardOrganizationsInstancesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string
  ): Promise<DashboardOrganizationsInstancesDeleteOutput> {
    let path = `organization/instances/${instanceId}`;
    return this._delete({
      path
    }).transform(mapDashboardOrganizationsInstancesDeleteOutput);
  }

  /**
   * @name Update organization instance
   * @description Update the role of an organization instance
   *
   * @param `instanceId` - string
   * @param `body` - DashboardOrganizationsInstancesUpdateBody
   *
   * @returns DashboardOrganizationsInstancesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    body: DashboardOrganizationsInstancesUpdateBody
  ): Promise<DashboardOrganizationsInstancesUpdateOutput> {
    let path = `organization/instances/${instanceId}`;
    return this._post({
      path,
      body: mapDashboardOrganizationsInstancesUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsInstancesUpdateOutput);
  }
}
