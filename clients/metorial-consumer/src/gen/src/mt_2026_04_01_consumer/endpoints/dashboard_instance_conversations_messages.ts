import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConversationsMessagesCreateBody,
  mapDashboardInstanceConversationsMessagesCreateOutput,
  mapDashboardInstanceConversationsMessagesGetOutput,
  mapDashboardInstanceConversationsMessagesListOutput,
  mapDashboardInstanceConversationsMessagesListQuery,
  type DashboardInstanceConversationsMessagesCreateBody,
  type DashboardInstanceConversationsMessagesCreateOutput,
  type DashboardInstanceConversationsMessagesGetOutput,
  type DashboardInstanceConversationsMessagesListOutput,
  type DashboardInstanceConversationsMessagesListQuery
} from '../resources';

/**
 * @name Assistants controller
 * @description Assistant and conversation endpoints
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceConversationsMessagesEndpoint {
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
   * @name List assistant messages
   * @description List messages in a specific assistant conversation.
   *
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `query` - DashboardInstanceConversationsMessagesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConversationsMessagesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    assistantConversationId: string,
    query?: DashboardInstanceConversationsMessagesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConversationsMessagesListOutput> {
    let path = `dashboard/instances/${instanceId}/conversations/${assistantConversationId}/messages`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceConversationsMessagesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConversationsMessagesListOutput
    );
  }

  /**
   * @name Create assistant message
   * @description Create a user message and assistant request in a specific conversation.
   *
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `body` - DashboardInstanceConversationsMessagesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConversationsMessagesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    assistantConversationId: string,
    body: DashboardInstanceConversationsMessagesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConversationsMessagesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/conversations/${assistantConversationId}/messages`;

    let request = {
      path,
      body: mapDashboardInstanceConversationsMessagesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceConversationsMessagesCreateOutput
    );
  }

  /**
   * @name Get assistant message
   * @description Get a specific assistant message.
   *
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `assistantMessageId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConversationsMessagesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    assistantConversationId: string,
    assistantMessageId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConversationsMessagesGetOutput> {
    let path = `dashboard/instances/${instanceId}/conversations/${assistantConversationId}/messages/${assistantMessageId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConversationsMessagesGetOutput
    );
  }
}
