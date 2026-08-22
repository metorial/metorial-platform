import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceWebhooksEventsGetOutput,
  mapDashboardInstanceWebhooksEventsListOutput,
  mapDashboardInstanceWebhooksEventsListQuery,
  type DashboardInstanceWebhooksEventsGetOutput,
  type DashboardInstanceWebhooksEventsListOutput,
  type DashboardInstanceWebhooksEventsListQuery
} from '../resources';

/**
 * @name Webhook Events controller
 * @description Read webhook delivery events from all authorized sources.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceWebhooksEventsEndpoint {
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
   * @name List webhook events
   * @description Returns a paginated list of webhook events.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceWebhooksEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceWebhooksEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksEventsListOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceWebhooksEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceWebhooksEventsListOutput
    );
  }

  /**
   * @name Get webhook event
   * @description Retrieves a webhook event with its deliveries and attempts.
   *
   * @param `instanceId` - string
   * @param `webhookEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceWebhooksEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    webhookEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceWebhooksEventsGetOutput> {
    let path = `dashboard/instances/${instanceId}/webhook-events/${webhookEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceWebhooksEventsGetOutput
    );
  }
}
