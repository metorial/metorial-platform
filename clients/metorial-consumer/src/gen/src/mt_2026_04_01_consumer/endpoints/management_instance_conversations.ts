import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConversationsCreateBody,
  mapDashboardInstanceConversationsCreateOutput,
  mapDashboardInstanceConversationsGetOutput,
  mapDashboardInstanceConversationsListOutput,
  mapDashboardInstanceConversationsListQuery,
  mapDashboardInstanceConversationsUpdateBody,
  mapDashboardInstanceConversationsUpdateOutput,
  type DashboardInstanceConversationsCreateBody,
  type DashboardInstanceConversationsCreateOutput,
  type DashboardInstanceConversationsGetOutput,
  type DashboardInstanceConversationsListOutput,
  type DashboardInstanceConversationsListQuery,
  type DashboardInstanceConversationsUpdateBody,
  type DashboardInstanceConversationsUpdateOutput
} from '../resources';

/**
 * @name Assistants controller
 * @description Assistant and conversation endpoints
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceConversationsEndpoint {
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
   * @name List assistant conversations
   * @description List assistant conversations in an instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceConversationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConversationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceConversationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConversationsListOutput> {
    let path = `instances/${instanceId}/conversations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceConversationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConversationsListOutput
    );
  }

  /**
   * @name Create assistant conversation
   * @description Create a new assistant conversation in an instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceConversationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConversationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceConversationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConversationsCreateOutput> {
    let path = `instances/${instanceId}/conversations`;

    let request = {
      path,
      body: mapDashboardInstanceConversationsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceConversationsCreateOutput
    );
  }

  /**
   * @name Get assistant conversation
   * @description Get a specific assistant conversation.
   *
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConversationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    assistantConversationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConversationsGetOutput> {
    let path = `instances/${instanceId}/conversations/${assistantConversationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConversationsGetOutput
    );
  }

  /**
   * @name Update assistant conversation
   * @description Update a specific assistant conversation.
   *
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `body` - DashboardInstanceConversationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConversationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    assistantConversationId: string,
    body: DashboardInstanceConversationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConversationsUpdateOutput> {
    let path = `instances/${instanceId}/conversations/${assistantConversationId}`;

    let request = {
      path,
      body: mapDashboardInstanceConversationsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceConversationsUpdateOutput
    );
  }
}
