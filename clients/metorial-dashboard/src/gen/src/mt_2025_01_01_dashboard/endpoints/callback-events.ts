import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbackEventsGetOutput,
  mapDashboardInstanceCallbackEventsListOutput,
  mapDashboardInstanceCallbackEventsListQuery,
  type DashboardInstanceCallbackEventsGetOutput,
  type DashboardInstanceCallbackEventsListOutput,
  type DashboardInstanceCallbackEventsListQuery
} from '../resources';

/**
 * @name Callback Events controller
 * @description A callback event is recorded every time a provider trigger behind one of your callbacks fires. Listing returns the events themselves; fetch a single event to enrich it with the payload the provider produced, and the inbound webhook behind it, if any.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCallbackEventsEndpoint {
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
   * @name List callback events
   * @description Returns a paginated list of callback events.
   *
   * @param `query` - DashboardInstanceCallbackEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbackEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceCallbackEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbackEventsListOutput> {
    let path = 'callback-events';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbackEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbackEventsListOutput
    );
  }

  /**
   * @name Get callback event
   * @description Retrieves a specific callback event by ID, enriched with the payload the provider produced for it and, if it came from a webhook, the inbound request behind it.
   *
   * @param `callbackEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbackEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    callbackEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbackEventsGetOutput> {
    let path = `callback-events/${callbackEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbackEventsGetOutput
    );
  }
}
