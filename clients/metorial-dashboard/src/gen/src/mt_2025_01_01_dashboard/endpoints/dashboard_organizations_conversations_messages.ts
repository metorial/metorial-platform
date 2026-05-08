import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsConversationsMessagesCreateBody,
  mapDashboardOrganizationsConversationsMessagesCreateOutput,
  mapDashboardOrganizationsConversationsMessagesGetOutput,
  mapDashboardOrganizationsConversationsMessagesListOutput,
  mapDashboardOrganizationsConversationsMessagesListQuery,
  type DashboardOrganizationsConversationsMessagesCreateBody,
  type DashboardOrganizationsConversationsMessagesCreateOutput,
  type DashboardOrganizationsConversationsMessagesGetOutput,
  type DashboardOrganizationsConversationsMessagesListOutput,
  type DashboardOrganizationsConversationsMessagesListQuery
} from '../resources';

/**
 * @name Assistants controller
 * @description Dashboard-only assistant and conversation endpoints
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsConversationsMessagesEndpoint {
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
   * @param `organizationId` - string
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `query` - DashboardOrganizationsConversationsMessagesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConversationsMessagesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    instanceId: string,
    assistantConversationId: string,
    query?: DashboardOrganizationsConversationsMessagesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConversationsMessagesListOutput> {
    let path = `dashboard/organizations/${organizationId}/instances/${instanceId}/conversations/${assistantConversationId}/messages`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsConversationsMessagesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConversationsMessagesListOutput
    );
  }

  /**
   * @name Create assistant message
   * @description Create a user message and assistant request in a specific conversation.
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `body` - DashboardOrganizationsConversationsMessagesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConversationsMessagesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    organizationId: string,
    instanceId: string,
    assistantConversationId: string,
    body: DashboardOrganizationsConversationsMessagesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConversationsMessagesCreateOutput> {
    let path = `dashboard/organizations/${organizationId}/instances/${instanceId}/conversations/${assistantConversationId}/messages`;

    let request = {
      path,
      body: mapDashboardOrganizationsConversationsMessagesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsConversationsMessagesCreateOutput
    );
  }

  /**
   * @name Get assistant message
   * @description Get a specific assistant message.
   *
   * @param `organizationId` - string
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `assistantMessageId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConversationsMessagesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    instanceId: string,
    assistantConversationId: string,
    assistantMessageId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConversationsMessagesGetOutput> {
    let path = `dashboard/organizations/${organizationId}/instances/${instanceId}/conversations/${assistantConversationId}/messages/${assistantMessageId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConversationsMessagesGetOutput
    );
  }
}
