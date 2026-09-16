import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsEventDeliveryAttemptsGetOutput,
  mapDashboardOrganizationsEventDeliveryAttemptsListOutput,
  mapDashboardOrganizationsEventDeliveryAttemptsListQuery,
  type DashboardOrganizationsEventDeliveryAttemptsGetOutput,
  type DashboardOrganizationsEventDeliveryAttemptsListOutput,
  type DashboardOrganizationsEventDeliveryAttemptsListQuery
} from '../resources';

/**
 * @name Event delivery attempts controller
 * @description A delivery attempt is one request Metorial made to an event destination, with the request it sent and the response it got back.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsEventDeliveryAttemptsEndpoint {
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
   * @name List event delivery attempts
   * @description List delivery attempts recorded for the organization
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsEventDeliveryAttemptsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDeliveryAttemptsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsEventDeliveryAttemptsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDeliveryAttemptsListOutput> {
    let path = `dashboard/organizations/${organizationId}/event-delivery-attempts`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsEventDeliveryAttemptsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDeliveryAttemptsListOutput
    );
  }

  /**
   * @name Get event delivery attempt
   * @description Get a specific delivery attempt, including the request Metorial sent and the response the destination returned
   *
   * @param `organizationId` - string
   * @param `eventDeliveryAttemptId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDeliveryAttemptsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    eventDeliveryAttemptId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDeliveryAttemptsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/event-delivery-attempts/${eventDeliveryAttemptId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDeliveryAttemptsGetOutput
    );
  }
}
