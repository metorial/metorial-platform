import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsMessagesCreateBody,
  mapDashboardInstanceChatsMessagesCreateOutput,
  mapDashboardInstanceChatsMessagesDeleteOutput,
  mapDashboardInstanceChatsMessagesDeleteQuery,
  mapDashboardInstanceChatsMessagesGetOutput,
  mapDashboardInstanceChatsMessagesGetQuery,
  mapDashboardInstanceChatsMessagesListOutput,
  mapDashboardInstanceChatsMessagesListQuery,
  mapDashboardInstanceChatsMessagesReadBody,
  mapDashboardInstanceChatsMessagesReadOutput,
  mapDashboardInstanceChatsMessagesUpdateBody,
  mapDashboardInstanceChatsMessagesUpdateOutput,
  type DashboardInstanceChatsMessagesCreateBody,
  type DashboardInstanceChatsMessagesCreateOutput,
  type DashboardInstanceChatsMessagesDeleteOutput,
  type DashboardInstanceChatsMessagesDeleteQuery,
  type DashboardInstanceChatsMessagesGetOutput,
  type DashboardInstanceChatsMessagesGetQuery,
  type DashboardInstanceChatsMessagesListOutput,
  type DashboardInstanceChatsMessagesListQuery,
  type DashboardInstanceChatsMessagesReadBody,
  type DashboardInstanceChatsMessagesReadOutput,
  type DashboardInstanceChatsMessagesUpdateBody,
  type DashboardInstanceChatsMessagesUpdateOutput
} from '../resources';

/**
 * @name Chat Messages controller
 * @description Chat messages are the individual messages sent within a chat channel.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialChatsMessagesEndpoint {
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
   * @name List chat messages
   * @description Returns a paginated list of messages in a chat channel.
   *
   * @param `chatId` - string
   * @param `query` - DashboardInstanceChatsMessagesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    chatId: string,
    query?: DashboardInstanceChatsMessagesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesListOutput> {
    let path = `chats/${chatId}/messages`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsMessagesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsMessagesListOutput
    );
  }

  /**
   * @name Get chat message
   * @description Retrieves a specific chat message.
   *
   * @param `chatId` - string
   * @param `messageId` - string
   * @param `query` - DashboardInstanceChatsMessagesGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    chatId: string,
    messageId: string,
    query?: DashboardInstanceChatsMessagesGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesGetOutput> {
    let path = `chats/${chatId}/messages/${messageId}`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsMessagesGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsMessagesGetOutput
    );
  }

  /**
   * @name Send chat message
   * @description Sends a new message to a chat channel.
   *
   * @param `chatId` - string
   * @param `body` - DashboardInstanceChatsMessagesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    chatId: string,
    body: DashboardInstanceChatsMessagesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesCreateOutput> {
    let path = `chats/${chatId}/messages`;

    let request = {
      path,
      body: mapDashboardInstanceChatsMessagesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatsMessagesCreateOutput
    );
  }

  /**
   * @name Edit chat message
   * @description Edits a specific chat message.
   *
   * @param `chatId` - string
   * @param `messageId` - string
   * @param `body` - DashboardInstanceChatsMessagesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    chatId: string,
    messageId: string,
    body: DashboardInstanceChatsMessagesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesUpdateOutput> {
    let path = `chats/${chatId}/messages/${messageId}`;

    let request = {
      path,
      body: mapDashboardInstanceChatsMessagesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceChatsMessagesUpdateOutput
    );
  }

  /**
   * @name Delete chat message
   * @description Deletes a specific chat message.
   *
   * @param `chatId` - string
   * @param `messageId` - string
   * @param `query` - DashboardInstanceChatsMessagesDeleteQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    chatId: string,
    messageId: string,
    query?: DashboardInstanceChatsMessagesDeleteQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesDeleteOutput> {
    let path = `chats/${chatId}/messages/${messageId}`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsMessagesDeleteQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceChatsMessagesDeleteOutput
    );
  }

  /**
   * @name Mark chat message read
   * @description Marks a specific chat message as read.
   *
   * @param `chatId` - string
   * @param `messageId` - string
   * @param `body` - DashboardInstanceChatsMessagesReadBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsMessagesReadOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  read(
    chatId: string,
    messageId: string,
    body: DashboardInstanceChatsMessagesReadBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsMessagesReadOutput> {
    let path = `chats/${chatId}/messages/${messageId}/read`;

    let request = {
      path,
      body: mapDashboardInstanceChatsMessagesReadBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatsMessagesReadOutput
    );
  }
}
