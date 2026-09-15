import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsChannelsGetOutput,
  mapDashboardInstanceChatsChannelsListOutput,
  mapDashboardInstanceChatsChannelsListQuery,
  type DashboardInstanceChatsChannelsGetOutput,
  type DashboardInstanceChatsChannelsListOutput,
  type DashboardInstanceChatsChannelsListQuery
} from '../resources';

/**
 * @name Chat Channels controller
 * @description Chat channels are the conversations within a chat, such as Slack channels or Microsoft Teams channels.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialChatsChannelsEndpoint {
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
   * @name List chat channels
   * @description Returns a paginated list of channels for a chat.
   *
   * @param `chatId` - string
   * @param `query` - DashboardInstanceChatsChannelsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsChannelsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    chatId: string,
    query?: DashboardInstanceChatsChannelsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsChannelsListOutput> {
    let path = `chats/${chatId}/channels`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsChannelsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsChannelsListOutput
    );
  }

  /**
   * @name Get chat channel
   * @description Retrieves a specific chat channel.
   *
   * @param `chatId` - string
   * @param `channelId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsChannelsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    chatId: string,
    channelId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsChannelsGetOutput> {
    let path = `chats/${chatId}/channels/${channelId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsChannelsGetOutput
    );
  }
}
