import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsChannelsMembersGetOutput,
  mapDashboardInstanceChatsChannelsMembersListOutput,
  mapDashboardInstanceChatsChannelsMembersListQuery,
  type DashboardInstanceChatsChannelsMembersGetOutput,
  type DashboardInstanceChatsChannelsMembersListOutput,
  type DashboardInstanceChatsChannelsMembersListQuery
} from '../resources';

/**
 * @name Chat Channels controller
 * @description Chat channels are the conversations within a chat, such as Slack channels or Microsoft Teams channels.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceChatsChannelsMembersEndpoint {
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
   * @name List chat channel members
   * @description Returns a paginated list of members of a chat channel.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `channelId` - string
   * @param `query` - DashboardInstanceChatsChannelsMembersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsChannelsMembersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    chatId: string,
    channelId: string,
    query?: DashboardInstanceChatsChannelsMembersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsChannelsMembersListOutput> {
    let path = `dashboard/instances/${instanceId}/chats/${chatId}/channels/${channelId}/members`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatsChannelsMembersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsChannelsMembersListOutput
    );
  }

  /**
   * @name Get chat channel member
   * @description Retrieves a specific member of a chat channel.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `channelId` - string
   * @param `userId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsChannelsMembersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatId: string,
    channelId: string,
    userId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsChannelsMembersGetOutput> {
    let path = `dashboard/instances/${instanceId}/chats/${chatId}/channels/${channelId}/members/${userId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatsChannelsMembersGetOutput
    );
  }
}
