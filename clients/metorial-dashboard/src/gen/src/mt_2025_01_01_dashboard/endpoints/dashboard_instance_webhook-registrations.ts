import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceWebhookRegistrationsCreateBody,
  mapDashboardInstanceWebhookRegistrationsCreateOutput,
  mapDashboardInstanceWebhookRegistrationsDeleteOutput,
  mapDashboardInstanceWebhookRegistrationsGetOutput,
  mapDashboardInstanceWebhookRegistrationsListOutput,
  mapDashboardInstanceWebhookRegistrationsListQuery,
  mapDashboardInstanceWebhookRegistrationsSetupBody,
  mapDashboardInstanceWebhookRegistrationsSetupOutput,
  mapDashboardInstanceWebhookRegistrationsUpdateBody,
  mapDashboardInstanceWebhookRegistrationsUpdateOutput,
  type DashboardInstanceWebhookRegistrationsCreateBody,
  type DashboardInstanceWebhookRegistrationsCreateOutput,
  type DashboardInstanceWebhookRegistrationsDeleteOutput,
  type DashboardInstanceWebhookRegistrationsGetOutput,
  type DashboardInstanceWebhookRegistrationsListOutput,
  type DashboardInstanceWebhookRegistrationsListQuery,
  type DashboardInstanceWebhookRegistrationsSetupBody,
  type DashboardInstanceWebhookRegistrationsSetupOutput,
  type DashboardInstanceWebhookRegistrationsUpdateBody,
  type DashboardInstanceWebhookRegistrationsUpdateOutput
} from '../resources';

/**
 * @name Webhook Registrations controller
 * @description Webhook registrations give you a Metorial-hosted URL to point a provider at, so the provider can deliver webhooks that turn into callback events.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceWebhookRegistrationsEndpoint {
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
   * @name List webhook registrations
   * @description Returns a paginated list of webhook registrations.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceWebhookRegistrationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhookRegistrationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceWebhookRegistrationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhookRegistrationsListOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-registrations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceWebhookRegistrationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceWebhookRegistrationsListOutput
    );
  }

  /**
   * @name Get webhook registration
   * @description Retrieves a specific webhook registration by ID.
   *
   * @param `instanceId` - string
   * @param `webhookRegistrationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhookRegistrationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    webhookRegistrationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhookRegistrationsGetOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-registrations/${webhookRegistrationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceWebhookRegistrationsGetOutput
    );
  }

  /**
   * @name Create webhook registration
   * @description Creates a webhook registration for a provider. Only providers whose type reports `triggers.webhook_registration.status` as `supported` can receive one. The registration starts out awaiting setup.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceWebhookRegistrationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhookRegistrationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceWebhookRegistrationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhookRegistrationsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-registrations`;

    let request = {
      path,
      body: mapDashboardInstanceWebhookRegistrationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceWebhookRegistrationsCreateOutput
    );
  }

  /**
   * @name Complete webhook registration setup
   * @description Submits the provider-specific configuration described by the registration setup document, activating the registration.
   *
   * @param `instanceId` - string
   * @param `webhookRegistrationId` - string
   * @param `body` - DashboardInstanceWebhookRegistrationsSetupBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhookRegistrationsSetupOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  setup(
    instanceId: string,
    webhookRegistrationId: string,
    body: DashboardInstanceWebhookRegistrationsSetupBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhookRegistrationsSetupOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-registrations/${webhookRegistrationId}/setup`;

    let request = {
      path,
      body: mapDashboardInstanceWebhookRegistrationsSetupBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceWebhookRegistrationsSetupOutput
    );
  }

  /**
   * @name Update webhook registration
   * @description Updates a webhook registration.
   *
   * @param `instanceId` - string
   * @param `webhookRegistrationId` - string
   * @param `body` - DashboardInstanceWebhookRegistrationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhookRegistrationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    webhookRegistrationId: string,
    body: DashboardInstanceWebhookRegistrationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhookRegistrationsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-registrations/${webhookRegistrationId}`;

    let request = {
      path,
      body: mapDashboardInstanceWebhookRegistrationsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceWebhookRegistrationsUpdateOutput
    );
  }

  /**
   * @name Delete webhook registration
   * @description Archives a webhook registration. The receiver is torn down on the provider before the record is removed for good.
   *
   * @param `instanceId` - string
   * @param `webhookRegistrationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhookRegistrationsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    webhookRegistrationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhookRegistrationsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-registrations/${webhookRegistrationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceWebhookRegistrationsDeleteOutput
    );
  }
}
