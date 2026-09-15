import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsGetOutput,
  mapDashboardInstanceChatsListOutput,
  mapDashboardInstanceChatsListQuery,
  type DashboardInstanceChatsGetOutput,
  type DashboardInstanceChatsListOutput,
  type DashboardInstanceChatsListQuery
} from '../resources';

/**
 * @name Chats controller
 * @description A chat represents a single connected chat surface, such as a Slack or Microsoft Teams tenant, running on a chat instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceChatsEndpoint {
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
   * @name List chats
   * @description Returns a paginated list of chats.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceChatsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceChatsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsListOutput> {
    let path = `instances/${instanceId}/chats`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceChatsListOutput);
  }

  /**
   * @name Get chat
   * @description Retrieves a specific chat.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsGetOutput> {
    let path = `instances/${instanceId}/chats/${chatId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceChatsGetOutput);
  }
}
