import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsMessagesReactionsCreateBody,
  mapDashboardInstanceChatsMessagesReactionsCreateOutput,
  mapDashboardInstanceChatsMessagesReactionsDeleteOutput,
  mapDashboardInstanceChatsMessagesReactionsDeleteQuery,
  mapDashboardInstanceChatsMessagesReactionsListOutput,
  mapDashboardInstanceChatsMessagesReactionsListQuery,
  type DashboardInstanceChatsMessagesReactionsCreateBody,
  type DashboardInstanceChatsMessagesReactionsCreateOutput,
  type DashboardInstanceChatsMessagesReactionsDeleteOutput,
  type DashboardInstanceChatsMessagesReactionsDeleteQuery,
  type DashboardInstanceChatsMessagesReactionsListOutput,
  type DashboardInstanceChatsMessagesReactionsListQuery
} from '../resources';

/**
 * @name Chat Messages controller
 * @description Chat messages are the individual messages sent within a chat channel.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceChatsMessagesReactionsEndpoint {
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
   * @name List chat message reactions
   * @description Returns the reactions left on a specific chat message.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `messageId` - string
   * @param `query` - DashboardInstanceChatsMessagesReactionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesReactionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    chatId: string,
    messageId: string,
    query?: DashboardInstanceChatsMessagesReactionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesReactionsListOutput> {
    let path = `dashboard/instances/${instanceId}/chats/${chatId}/messages/${messageId}/reactions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsMessagesReactionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsMessagesReactionsListOutput
    );
  }

  /**
   * @name Add chat message reaction
   * @description Adds a reaction to a specific chat message.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `messageId` - string
   * @param `body` - DashboardInstanceChatsMessagesReactionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesReactionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    chatId: string,
    messageId: string,
    body: DashboardInstanceChatsMessagesReactionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesReactionsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/chats/${chatId}/messages/${messageId}/reactions`;

    let request = {
      path,
      body: mapDashboardInstanceChatsMessagesReactionsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatsMessagesReactionsCreateOutput
    );
  }

  /**
   * @name Remove chat message reaction
   * @description Removes a reaction from a specific chat message.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `messageId` - string
   * @param `query` - DashboardInstanceChatsMessagesReactionsDeleteQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesReactionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    chatId: string,
    messageId: string,
    query?: DashboardInstanceChatsMessagesReactionsDeleteQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesReactionsDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/chats/${chatId}/messages/${messageId}/reactions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsMessagesReactionsDeleteQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceChatsMessagesReactionsDeleteOutput
    );
  }
}
