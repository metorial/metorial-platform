import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsJoinAcceptBody,
  mapDashboardOrganizationsJoinAcceptOutput,
  mapDashboardOrganizationsJoinGetOutput,
  mapDashboardOrganizationsJoinGetQuery,
  mapDashboardOrganizationsJoinRejectBody,
  mapDashboardOrganizationsJoinRejectOutput,
  type DashboardOrganizationsJoinAcceptBody,
  type DashboardOrganizationsJoinAcceptOutput,
  type DashboardOrganizationsJoinGetOutput,
  type DashboardOrganizationsJoinGetQuery,
  type DashboardOrganizationsJoinRejectBody,
  type DashboardOrganizationsJoinRejectOutput
} from '../resources';

/**
 * @name Organization controller
 * @description Read and write organization information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsJoinEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Join organization
   * @description Join an organization
   *
   * @param `query` - DashboardOrganizationsJoinGetQuery
   *
   * @returns DashboardOrganizationsJoinGetOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(query?: DashboardOrganizationsJoinGetQuery) {
    return this._get({
      path: ['dashboard', 'organization-join', 'find'],

      query: query
        ? mapDashboardOrganizationsJoinGetQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardOrganizationsJoinGetOutput);
  }

  /**
   * @name Join organization
   * @description Join an organization
   *
   * @param `body` - DashboardOrganizationsJoinAcceptBody
   *
   * @returns DashboardOrganizationsJoinAcceptOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  accept(body: DashboardOrganizationsJoinAcceptBody) {
    return this._post({
      path: ['dashboard', 'organization-join', 'accept'],
      body: mapDashboardOrganizationsJoinAcceptBody.transformTo(body)
    }).transform(mapDashboardOrganizationsJoinAcceptOutput);
  }

  /**
   * @name Reject organization invite
   * @description Reject an organization invite
   *
   * @param `body` - DashboardOrganizationsJoinRejectBody
   *
   * @returns DashboardOrganizationsJoinRejectOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reject(body: DashboardOrganizationsJoinRejectBody) {
    return this._post({
      path: ['dashboard', 'organization-join', 'reject'],
      body: mapDashboardOrganizationsJoinRejectBody.transformTo(body)
    }).transform(mapDashboardOrganizationsJoinRejectOutput);
  }
}
