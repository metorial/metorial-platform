import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIncomingWebhooksGetOutput,
  mapDashboardInstanceIncomingWebhooksListOutput,
  mapDashboardInstanceIncomingWebhooksListQuery,
  type DashboardInstanceIncomingWebhooksGetOutput,
  type DashboardInstanceIncomingWebhooksListOutput,
  type DashboardInstanceIncomingWebhooksListQuery
} from '../resources';

/**
 * @name Incoming Webhooks controller
 * @description An incoming webhook is a raw inbound HTTP request received for a provider. You see every request received on your own webhook registrations, plus requests received on endpoints Metorial operates for a provider when they produced one of your callback events.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceIncomingWebhooksEndpoint {
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
   * @name List incoming webhooks
   * @description Returns a paginated list of incoming webhooks you can see.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceIncomingWebhooksListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIncomingWebhooksListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceIncomingWebhooksListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIncomingWebhooksListOutput> {
    let path = `dashboard/instances/${instanceId}/incoming-webhooks`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIncomingWebhooksListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIncomingWebhooksListOutput
    );
  }

  /**
   * @name Get incoming webhook
   * @description Retrieves an incoming webhook.
   *
   * @param `instanceId` - string
   * @param `incomingWebhookId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIncomingWebhooksGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    incomingWebhookId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIncomingWebhooksGetOutput> {
    let path = `dashboard/instances/${instanceId}/incoming-webhooks/${incomingWebhookId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIncomingWebhooksGetOutput
    );
  }
}
