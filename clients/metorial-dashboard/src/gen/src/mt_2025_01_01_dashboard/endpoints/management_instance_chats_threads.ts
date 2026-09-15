import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsThreadsGetOutput,
  mapDashboardInstanceChatsThreadsGetQuery,
  mapDashboardInstanceChatsThreadsListOutput,
  mapDashboardInstanceChatsThreadsListQuery,
  type DashboardInstanceChatsThreadsGetOutput,
  type DashboardInstanceChatsThreadsGetQuery,
  type DashboardInstanceChatsThreadsListOutput,
  type DashboardInstanceChatsThreadsListQuery
} from '../resources';

/**
 * @name Chat Threads controller
 * @description Chat threads group replies to a message within a chat channel.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceChatsThreadsEndpoint {
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
   * @name List chat threads
   * @description Returns a paginated list of threads in a chat channel.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `query` - DashboardInstanceChatsThreadsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsThreadsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    chatId: string,
    query?: DashboardInstanceChatsThreadsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsThreadsListOutput> {
    let path = `instances/${instanceId}/chats/${chatId}/threads`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsThreadsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsThreadsListOutput
    );
  }

  /**
   * @name Get chat thread
   * @description Retrieves a specific chat thread.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `threadId` - string
   * @param `query` - DashboardInstanceChatsThreadsGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsThreadsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatId: string,
    threadId: string,
    query?: DashboardInstanceChatsThreadsGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsThreadsGetOutput> {
    let path = `instances/${instanceId}/chats/${chatId}/threads/${threadId}`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsThreadsGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsThreadsGetOutput
    );
  }
}
