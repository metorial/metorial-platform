import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsChannelsTypingStartBody,
  mapDashboardInstanceChatsChannelsTypingStartOutput,
  type DashboardInstanceChatsChannelsTypingStartBody,
  type DashboardInstanceChatsChannelsTypingStartOutput
} from '../resources';

/**
 * @name Chat Channels controller
 * @description Chat channels are the conversations within a chat, such as Slack channels or Microsoft Teams channels.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceChatsChannelsTypingEndpoint {
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
   * @name Start chat typing indicator
   * @description Shows a typing indicator in a chat channel.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `channelId` - string
   * @param `body` - DashboardInstanceChatsChannelsTypingStartBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsChannelsTypingStartOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  start(
    instanceId: string,
    chatId: string,
    channelId: string,
    body: DashboardInstanceChatsChannelsTypingStartBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsChannelsTypingStartOutput> {
    let path = `dashboard/instances/${instanceId}/chats/${chatId}/channels/${channelId}/typing`;

    let request = {
      path,
      body: mapDashboardInstanceChatsChannelsTypingStartBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatsChannelsTypingStartOutput
    );
  }
}
