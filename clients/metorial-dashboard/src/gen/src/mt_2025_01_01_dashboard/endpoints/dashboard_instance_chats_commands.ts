import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsCommandsRespondBody,
  mapDashboardInstanceChatsCommandsRespondOutput,
  type DashboardInstanceChatsCommandsRespondBody,
  type DashboardInstanceChatsCommandsRespondOutput
} from '../resources';

/**
 * @name Chat Messages controller
 * @description Chat messages are the individual messages sent within a chat channel.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceChatsCommandsEndpoint {
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
   * @name Respond to chat command
   * @description Replies to a slash command from a chat.command.invoked event, using the provider's native command response.
   *
   * @param `instanceId` - string
   * @param `chatId` - string
   * @param `body` - DashboardInstanceChatsCommandsRespondBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsCommandsRespondOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  respond(
    instanceId: string,
    chatId: string,
    body: DashboardInstanceChatsCommandsRespondBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsCommandsRespondOutput> {
    let path = `dashboard/instances/${instanceId}/chats/${chatId}/commands/respond`;

    let request = {
      path,
      body: mapDashboardInstanceChatsCommandsRespondBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatsCommandsRespondOutput
    );
  }
}
