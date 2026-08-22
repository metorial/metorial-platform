import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceWebhooksDestinationsCreateBody,
  mapDashboardInstanceWebhooksDestinationsCreateOutput,
  mapDashboardInstanceWebhooksDestinationsDeleteOutput,
  mapDashboardInstanceWebhooksDestinationsGetOutput,
  mapDashboardInstanceWebhooksDestinationsListOutput,
  mapDashboardInstanceWebhooksDestinationsListQuery,
  mapDashboardInstanceWebhooksDestinationsRotateSigningSecretOutput,
  mapDashboardInstanceWebhooksDestinationsUpdateBody,
  mapDashboardInstanceWebhooksDestinationsUpdateOutput,
  type DashboardInstanceWebhooksDestinationsCreateBody,
  type DashboardInstanceWebhooksDestinationsCreateOutput,
  type DashboardInstanceWebhooksDestinationsDeleteOutput,
  type DashboardInstanceWebhooksDestinationsGetOutput,
  type DashboardInstanceWebhooksDestinationsListOutput,
  type DashboardInstanceWebhooksDestinationsListQuery,
  type DashboardInstanceWebhooksDestinationsRotateSigningSecretOutput,
  type DashboardInstanceWebhooksDestinationsUpdateBody,
  type DashboardInstanceWebhooksDestinationsUpdateOutput
} from '../resources';

/**
 * @name Webhook Destinations controller
 * @description Manage webhook delivery destinations.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceWebhooksDestinationsEndpoint {
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
   * @name List webhook destinations
   * @description Returns a paginated list of webhook destinations.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceWebhooksDestinationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksDestinationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceWebhooksDestinationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksDestinationsListOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-destinations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceWebhooksDestinationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceWebhooksDestinationsListOutput
    );
  }

  /**
   * @name Get webhook destination
   * @description Retrieves a specific webhook destination.
   *
   * @param `instanceId` - string
   * @param `webhookDestinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksDestinationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    webhookDestinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksDestinationsGetOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-destinations/${webhookDestinationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceWebhooksDestinationsGetOutput
    );
  }

  /**
   * @name Create webhook destination
   * @description Creates and materializes a webhook destination.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceWebhooksDestinationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksDestinationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceWebhooksDestinationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksDestinationsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-destinations`;

    let request = {
      path,
      body: mapDashboardInstanceWebhooksDestinationsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceWebhooksDestinationsCreateOutput
    );
  }

  /**
   * @name Update webhook destination
   * @description Updates a webhook destination.
   *
   * @param `instanceId` - string
   * @param `webhookDestinationId` - string
   * @param `body` - DashboardInstanceWebhooksDestinationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksDestinationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    webhookDestinationId: string,
    body: DashboardInstanceWebhooksDestinationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksDestinationsUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-destinations/${webhookDestinationId}`;

    let request = {
      path,
      body: mapDashboardInstanceWebhooksDestinationsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceWebhooksDestinationsUpdateOutput
    );
  }

  /**
   * @name Rotate webhook destination signing secret
   * @description Rotates the outbound webhook signing secret and returns it once.
   *
   * @param `instanceId` - string
   * @param `webhookDestinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksDestinationsRotateSigningSecretOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  rotateSigningSecret(
    instanceId: string,
    webhookDestinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksDestinationsRotateSigningSecretOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-destinations/${webhookDestinationId}/security/signing-secret/rotate`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceWebhooksDestinationsRotateSigningSecretOutput
    );
  }

  /**
   * @name Delete webhook destination
   * @description Archives a webhook destination.
   *
   * @param `instanceId` - string
   * @param `webhookDestinationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksDestinationsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    webhookDestinationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksDestinationsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-destinations/${webhookDestinationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceWebhooksDestinationsDeleteOutput
    );
  }
}
