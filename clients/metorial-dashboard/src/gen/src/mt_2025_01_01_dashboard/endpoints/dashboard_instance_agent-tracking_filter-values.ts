import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingFilterValuesListOutput,
  mapDashboardInstanceAgentTrackingFilterValuesListQuery,
  type DashboardInstanceAgentTrackingFilterValuesListOutput,
  type DashboardInstanceAgentTrackingFilterValuesListQuery
} from '../resources';

/**
 * @name Agent Tracking Filter Values controller
 * @description The members, models, clients and seats a filter can choose from.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingFilterValuesEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name List filter values
   * @description Returns the members, models, clients or seats that sent usage in a range, including members seen only in telemetry. Seats come from request records and need a range of at most 90 days. With `value`, describes those values instead, without reading usage. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingFilterValuesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingFilterValuesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingFilterValuesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingFilterValuesListOutput> {
    let path = `dashboard/instances/${instanceId}/agent-tracking/filter-values`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingFilterValuesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingFilterValuesListOutput
    );
  }
}
