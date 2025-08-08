import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardUsageTimelineOutput,
  mapDashboardUsageTimelineQuery,
  type DashboardUsageTimelineOutput,
  type DashboardUsageTimelineQuery
} from '../resources';

/**
 * @name Usage controller
 * @description Get usage information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardUsageEndpoint extends BaseMetorialEndpoint<any> {
  constructor(config: MetorialEndpointManager<any>) {
    super(config);
  }

  /**
   * @name Get organization
   * @description Get the current organization information
   *
   * @param `organizationId` - string
   * @param `query` - DashboardUsageTimelineQuery
   *
   * @returns DashboardUsageTimelineOutput
   *
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  timeline(
    organizationId: string,
    query?: DashboardUsageTimelineQuery
  ): Promise<DashboardUsageTimelineOutput> {
    let path = `dashboard/organizations/${organizationId}/usage/timeline`;
    return this._get({
      path,

      query: query
        ? mapDashboardUsageTimelineQuery.transformTo(query)
        : undefined
    }).transform(mapDashboardUsageTimelineOutput);
  }
}
