import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceWebhooksDestinationsEventsListOutput,
  mapDashboardInstanceWebhooksDestinationsEventsListQuery,
  type DashboardInstanceWebhooksDestinationsEventsListOutput,
  type DashboardInstanceWebhooksDestinationsEventsListQuery
} from '../resources';

/**
 * @name Webhook Destinations controller
 * @description Manage webhook delivery destinations.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceWebhooksDestinationsEventsEndpoint {
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
   * @name List webhook destination events
   * @description Lists webhook events delivered to this destination.
   *
   * @param `instanceId` - string
   * @param `webhookDestinationId` - string
   * @param `query` - DashboardInstanceWebhooksDestinationsEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksDestinationsEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    webhookDestinationId: string,
    query?: DashboardInstanceWebhooksDestinationsEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksDestinationsEventsListOutput> {
    let path = `instances/${instanceId}/webhook-destinations/${webhookDestinationId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceWebhooksDestinationsEventsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceWebhooksDestinationsEventsListOutput
    );
  }
}
