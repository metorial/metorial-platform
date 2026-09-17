import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsEventDeliveriesGetOutput,
  mapDashboardOrganizationsEventDeliveriesListOutput,
  mapDashboardOrganizationsEventDeliveriesListQuery,
  mapDashboardOrganizationsEventDeliveriesRetryOutput,
  type DashboardOrganizationsEventDeliveriesGetOutput,
  type DashboardOrganizationsEventDeliveriesListOutput,
  type DashboardOrganizationsEventDeliveriesListQuery,
  type DashboardOrganizationsEventDeliveriesRetryOutput
} from '../resources';

/**
 * @name Event deliveries controller
 * @description An event delivery is Metorial's record of sending one event to one event destination, including every attempt it took to get there.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsEventDeliveriesEndpoint {
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
   * @name List event deliveries
   * @description List event deliveries recorded for the organization
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsEventDeliveriesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDeliveriesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsEventDeliveriesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDeliveriesListOutput> {
    let path = `dashboard/organizations/${organizationId}/event-deliveries`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsEventDeliveriesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDeliveriesListOutput
    );
  }

  /**
   * @name Get event delivery
   * @description Get a specific event delivery recorded for the organization
   *
   * @param `organizationId` - string
   * @param `eventDeliveryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDeliveriesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    eventDeliveryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDeliveriesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/event-deliveries/${eventDeliveryId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDeliveriesGetOutput
    );
  }

  /**
   * @name Retry event delivery
   * @description Schedules another attempt for a delivery that has finished, whether it succeeded or gave up. The delivery is given a fresh attempt budget.
   *
   * @param `organizationId` - string
   * @param `eventDeliveryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDeliveriesRetryOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  retry(
    organizationId: string,
    eventDeliveryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDeliveriesRetryOutput> {
    let path = `dashboard/organizations/${organizationId}/event-deliveries/${eventDeliveryId}/retry`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsEventDeliveriesRetryOutput
    );
  }
}
