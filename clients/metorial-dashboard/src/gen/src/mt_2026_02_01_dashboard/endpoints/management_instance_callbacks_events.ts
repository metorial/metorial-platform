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
 * @description Represents callbacks that you have uploaded to Metorial. Callbacks can be linked to various resources based on their purpose. Metorial can also automatically extract callbacks for you, for example for data exports.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceCallbacksEventsEndpoint {
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
   * @description Returns a paginated list of callback events for a specific callback.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceCallbacksEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceCallbacksEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksEventsListOutput> {
    let path = `instances/${instanceId}/callbacks-events`;

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
   * @name Get callback event by ID
   * @description Retrieves details for a specific callback by its ID.
   *
   * @param `instanceId` - string
   * @param `eventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCallbacksEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    eventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCallbacksEventsGetOutput> {
    let path = `instances/${instanceId}/callbacks-events/${eventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCallbacksEventsGetOutput
    );
  }
}
