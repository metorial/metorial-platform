import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsEventDestinationsArchiveOutput,
  mapDashboardOrganizationsEventDestinationsCreateBody,
  mapDashboardOrganizationsEventDestinationsCreateOutput,
  mapDashboardOrganizationsEventDestinationsGetOutput,
  mapDashboardOrganizationsEventDestinationsListOutput,
  mapDashboardOrganizationsEventDestinationsListQuery,
  mapDashboardOrganizationsEventDestinationsRotateWebhookSecretOutput,
  mapDashboardOrganizationsEventDestinationsUpdateBody,
  mapDashboardOrganizationsEventDestinationsUpdateOutput,
  type DashboardOrganizationsEventDestinationsArchiveOutput,
  type DashboardOrganizationsEventDestinationsCreateBody,
  type DashboardOrganizationsEventDestinationsCreateOutput,
  type DashboardOrganizationsEventDestinationsGetOutput,
  type DashboardOrganizationsEventDestinationsListOutput,
  type DashboardOrganizationsEventDestinationsListQuery,
  type DashboardOrganizationsEventDestinationsRotateWebhookSecretOutput,
  type DashboardOrganizationsEventDestinationsUpdateBody,
  type DashboardOrganizationsEventDestinationsUpdateOutput
} from '../resources';

/**
 * @name Event destinations controller
 * @description Event destinations are where Metorial delivers system events for your organization. Webhooks are currently the only supported delivery type.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsEventDestinationsEndpoint {
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
   * @name List event destinations
   * @description List all event destinations configured for the organization
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsEventDestinationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsEventDestinationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationsListOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destinations`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsEventDestinationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDestinationsListOutput
    );
  }

  /**
   * @name Get event destination
   * @description Get a specific event destination configured for the organization
   *
   * @param `organizationId` - string
   * @param `eventDestinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    eventDestinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destinations/${eventDestinationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsEventDestinationsGetOutput
    );
  }

  /**
   * @name Create event destination
   * @description Create an event destination for the organization
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsEventDestinationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    body: DashboardOrganizationsEventDestinationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationsCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destinations`;

    let request = {
      path,
      body: mapDashboardOrganizationsEventDestinationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsEventDestinationsCreateOutput
    );
  }

  /**
   * @name Update event destination
   * @description Update an event destination configured for the organization
   *
   * @param `organizationId` - string
   * @param `eventDestinationId` - string
   * @param `body` - DashboardOrganizationsEventDestinationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    eventDestinationId: string,
    body: DashboardOrganizationsEventDestinationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationsUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destinations/${eventDestinationId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsEventDestinationsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsEventDestinationsUpdateOutput
    );
  }

  /**
   * @name Archive event destination
   * @description Archives an event destination. Listeners pointed at it stop being delivered to.
   *
   * @param `organizationId` - string
   * @param `eventDestinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationsArchiveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  archive(
    organizationId: string,
    eventDestinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationsArchiveOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destinations/${eventDestinationId}/archive`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsEventDestinationsArchiveOutput
    );
  }

  /**
   * @name Rotate event destination webhook secret
   * @description Generates a new signing secret for this event destination's webhook, invalidating the previous one. The new secret is only returned in this response.
   *
   * @param `organizationId` - string
   * @param `eventDestinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsEventDestinationsRotateWebhookSecretOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rotateWebhookSecret(
    organizationId: string,
    eventDestinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsEventDestinationsRotateWebhookSecretOutput> {
    let path = `dashboard/organizations/${organizationId}/event-destinations/${eventDestinationId}/rotate-webhook-secret`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsEventDestinationsRotateWebhookSecretOutput
    );
  }
}
