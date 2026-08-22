import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCallbacksEventsGetOutput,
  mapDashboardInstanceCallbacksEventsListOutput,
  mapDashboardInstanceCallbacksEventsListQuery,
  type DashboardInstanceCallbacksEventsGetOutput,
  type DashboardInstanceCallbacksEventsListOutput,
  type DashboardInstanceCallbacksEventsListQuery
} from '../resources';

/**
 * @name Callback Events controller
 * @description Read inbound callback trigger events across an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCallbacksEventsEndpoint {
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
   * @param `query` - DashboardInstanceCallbacksEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceCallbacksEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksEventsListOutput> {
    let path = 'callback-events';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceCallbacksEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksEventsListOutput
    );
  }

  /**
   * @name Get callback event
   * @description Retrieves a specific callback event.
   *
   * @param `callbackEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    callbackEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksEventsGetOutput> {
    let path = `callback-events/${callbackEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksEventsGetOutput
    );
  }
}
