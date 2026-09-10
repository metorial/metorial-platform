import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsEventsGetOutput,
  mapDashboardOrganizationsEventsListOutput,
  mapDashboardOrganizationsEventsListQuery,
  type DashboardOrganizationsEventsGetOutput,
  type DashboardOrganizationsEventsListOutput,
  type DashboardOrganizationsEventsListQuery
} from '../resources';

/**
 * @name Events controller
 * @description Events are the record of everything Metorial delivers to your event destinations — both normal resource events and callback occurrences.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsEventsEndpoint {
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
   * @name List events
   * @description List events recorded for the organization
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventsListOutput> {
    let path = `dashboard/organizations/${organizationId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventsListOutput
    );
  }

  /**
   * @name Get event
   * @description Get a specific event recorded for the organization
   *
   * @param `organizationId` - string
   * @param `eventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    eventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/events/${eventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventsGetOutput
    );
  }
}
