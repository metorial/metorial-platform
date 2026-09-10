import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsEventDestinationListenersCreateBody,
  mapDashboardOrganizationsEventDestinationListenersCreateOutput,
  mapDashboardOrganizationsEventDestinationListenersDeleteOutput,
  mapDashboardOrganizationsEventDestinationListenersGetOutput,
  mapDashboardOrganizationsEventDestinationListenersListOutput,
  mapDashboardOrganizationsEventDestinationListenersListQuery,
  mapDashboardOrganizationsEventDestinationListenersUpdateBody,
  mapDashboardOrganizationsEventDestinationListenersUpdateOutput,
  type DashboardOrganizationsEventDestinationListenersCreateBody,
  type DashboardOrganizationsEventDestinationListenersCreateOutput,
  type DashboardOrganizationsEventDestinationListenersDeleteOutput,
  type DashboardOrganizationsEventDestinationListenersGetOutput,
  type DashboardOrganizationsEventDestinationListenersListOutput,
  type DashboardOrganizationsEventDestinationListenersListQuery,
  type DashboardOrganizationsEventDestinationListenersUpdateBody,
  type DashboardOrganizationsEventDestinationListenersUpdateOutput
} from '../resources';

/**
 * @name Event destination listeners controller
 * @description Event destination listeners subscribe an event destination to events for a specific instance — either generic resource events, or a callback's trigger events.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsEventDestinationListenersEndpoint {
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
   * @name List event destination listeners
   * @description Returns a paginated list of event destination listeners for the organization.
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsEventDestinationListenersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationListenersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsEventDestinationListenersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationListenersListOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destination-listeners`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsEventDestinationListenersListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDestinationListenersListOutput
    );
  }

  /**
   * @name Get event destination listener
   * @description Retrieves a specific event destination listener by ID.
   *
   * @param `organizationId` - string
   * @param `eventDestinationListenerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationListenersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    eventDestinationListenerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationListenersGetOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destination-listeners/${eventDestinationListenerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDestinationListenersGetOutput
    );
  }

  /**
   * @name Create event destination listener
   * @description Subscribes an event destination to events for this instance — either generic resource events or a callback's trigger events.
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsEventDestinationListenersCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationListenersCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsEventDestinationListenersCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationListenersCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destination-listeners`;

    let request = {
      path,
      body: mapDashboardOrganizationsEventDestinationListenersCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsEventDestinationListenersCreateOutput
    );
  }

  /**
   * @name Update event destination listener
   * @description Updates the event types or callback triggers an event destination listener subscribes to.
   *
   * @param `organizationId` - string
   * @param `eventDestinationListenerId` - string
   * @param `body` - DashboardOrganizationsEventDestinationListenersUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationListenersUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    eventDestinationListenerId: string,
    body: DashboardOrganizationsEventDestinationListenersUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationListenersUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destination-listeners/${eventDestinationListenerId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsEventDestinationListenersUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsEventDestinationListenersUpdateOutput
    );
  }

  /**
   * @name Delete event destination listener
   * @description Removes an event destination listener.
   *
   * @param `organizationId` - string
   * @param `eventDestinationListenerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationListenersDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    organizationId: string,
    eventDestinationListenerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationListenersDeleteOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destination-listeners/${eventDestinationListenerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardOrganizationsEventDestinationListenersDeleteOutput
    );
  }
}
