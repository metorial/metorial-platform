import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatInstancesProviderAuthenticatedUserOutput,
  mapDashboardInstanceChatInstancesProviderGetOutput,
  mapDashboardInstanceChatInstancesProviderSetBody,
  mapDashboardInstanceChatInstancesProviderSetOutput,
  type DashboardInstanceChatInstancesProviderAuthenticatedUserOutput,
  type DashboardInstanceChatInstancesProviderGetOutput,
  type DashboardInstanceChatInstancesProviderSetBody,
  type DashboardInstanceChatInstancesProviderSetOutput
} from '../resources';

/**
 * @name Chat Instances controller
 * @description Chat instances materialize a chat connection for a specific runtime configuration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceChatInstancesProviderEndpoint {
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
   * @name Get chat instance provider
   * @description Retrieves the single provider configured for a chat instance.
   *
   * @param `instanceId` - string
   * @param `chatInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesProviderGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesProviderGetOutput> {
    let path = `instances/${instanceId}/chat/instances/${chatInstanceId}/provider`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatInstancesProviderGetOutput
    );
  }

  /**
   * @name Set chat instance provider
   * @description Creates or updates the single provider for a chat instance.
   *
   * @param `instanceId` - string
   * @param `chatInstanceId` - string
   * @param `body` - DashboardInstanceChatInstancesProviderSetBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesProviderSetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  set(
    instanceId: string,
    chatInstanceId: string,
    body: DashboardInstanceChatInstancesProviderSetBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesProviderSetOutput> {
    let path = `instances/${instanceId}/chat/instances/${chatInstanceId}/provider`;

    let request = {
      path,
      body: mapDashboardInstanceChatInstancesProviderSetBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceChatInstancesProviderSetOutput
    );
  }

  /**
   * @name Get chat instance authenticated user
   * @description Retrieves the chat provider account this chat instance is authenticated as.
   *
   * @param `instanceId` - string
   * @param `chatInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesProviderAuthenticatedUserOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  authenticatedUser(
    instanceId: string,
    chatInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesProviderAuthenticatedUserOutput> {
    let path = `instances/${instanceId}/chat/instances/${chatInstanceId}/provider/authenticated-user`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatInstancesProviderAuthenticatedUserOutput
    );
  }
}
