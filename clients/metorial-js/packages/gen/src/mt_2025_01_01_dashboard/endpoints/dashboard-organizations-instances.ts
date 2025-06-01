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
export class MetorialDashboardOrganizationsInstancesEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name List organization instances
   * @description List all organization instances
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsInstancesListQuery
   *
   * @returns DashboardOrganizationsInstancesListOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsInstancesListQuery
  ) {
    return this._get({
      path: ['dashboard', 'organizations', organizationId, 'instances'],

      query: query
        ? mapDashboardOrganizationsInstancesListQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsInstancesListOutput);
  }

  /**
   * @name Get organization instance
   * @description Get the information of a specific organization instance
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   *
   * @returns DashboardOrganizationsInstancesGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(organizationId: string, instanceId: string) {
    return this._get({
      path: [
        'dashboard',
        'organizations',
        organizationId,
        'instances',
        instanceId
      ]
    }).transform(mapDashboardOrganizationsInstancesGetOutput);
  }

  /**
   * @name Create organization instance
   * @description Create a new organization instance
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsInstancesCreateBody
   *
   * @returns DashboardOrganizationsInstancesCreateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsInstancesCreateBody
  ) {
    return this._post({
      path: ['dashboard', 'organizations', organizationId, 'instances'],
      body: mapDashboardOrganizationsInstancesCreateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsInstancesCreateOutput);
  }

  /**
   * @name Delete organization instance
   * @description Remove an organization instance
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   *
   * @returns DashboardOrganizationsInstancesDeleteOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(organizationId: string, instanceId: string) {
    return this._delete({
      path: [
        'dashboard',
        'organizations',
        organizationId,
        'instances',
        instanceId
      ]
    }).transform(mapDashboardOrganizationsInstancesDeleteOutput);
  }

  /**
   * @name Update organization instance
   * @description Update the role of an organization instance
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   * @param `body` - DashboardOrganizationsInstancesUpdateBody
   *
   * @returns DashboardOrganizationsInstancesUpdateOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    instanceId: string,
    body: DashboardOrganizationsInstancesUpdateBody
  ) {
    return this._post({
      path: [
        'dashboard',
        'organizations',
        organizationId,
        'instances',
        instanceId
      ],
      body: mapDashboardOrganizationsInstancesUpdateBody.transformTo(body)
    }).transform(mapDashboardOrganizationsInstancesUpdateOutput);
  }
}
