import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatEventsGetOutput,
  mapDashboardInstanceChatEventsListOutput,
  mapDashboardInstanceChatEventsListQuery,
  type DashboardInstanceChatEventsGetOutput,
  type DashboardInstanceChatEventsListOutput,
  type DashboardInstanceChatEventsListQuery
} from '../resources';

/**
 * @name Chat Events controller
 * @description Chat events record what happened on a chat, such as a new message, reaction, or membership change.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceChatEventsEndpoint {
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
   * @name List chat events
   * @description Returns a paginated list of chat events.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceChatEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceChatEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatEventsListOutput> {
    let path = `instances/${instanceId}/chat/events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatEventsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatEventsListOutput
    );
  }

  /**
   * @name Get chat event
   * @description Retrieves a specific chat event.
   *
   * @param `instanceId` - string
   * @param `chatEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatEventsGetOutput> {
    let path = `instances/${instanceId}/chat/events/${chatEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatEventsGetOutput
    );
  }
}
