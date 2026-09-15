import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatsDmsOpenBody,
  mapDashboardInstanceChatsDmsOpenOutput,
  type DashboardInstanceChatsDmsOpenBody,
  type DashboardInstanceChatsDmsOpenOutput
} from '../resources';

/**
 * @name Chat DMs controller
 * @description Open direct message channels with one or more users on a chat.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialChatsDmsEndpoint {
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
   * @name Open chat DM
   * @description Opens (or retrieves) a direct message channel with one or more users.
   *
   * @param `chatId` - string
   * @param `body` - DashboardInstanceChatsDmsOpenBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatsDmsOpenOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  open(
    chatId: string,
    body: DashboardInstanceChatsDmsOpenBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatsDmsOpenOutput> {
    let path = `chats/${chatId}/dms`;

    let request = {
      path,
      body: mapDashboardInstanceChatsDmsOpenBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatsDmsOpenOutput
    );
  }
}
