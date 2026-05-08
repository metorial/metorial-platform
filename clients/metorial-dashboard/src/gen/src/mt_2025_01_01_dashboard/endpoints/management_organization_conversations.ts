import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsConversationsCreateBody,
  mapDashboardOrganizationsConversationsCreateOutput,
  mapDashboardOrganizationsConversationsGetOutput,
  mapDashboardOrganizationsConversationsListOutput,
  mapDashboardOrganizationsConversationsListQuery,
  mapDashboardOrganizationsConversationsUpdateBody,
  mapDashboardOrganizationsConversationsUpdateOutput,
  type DashboardOrganizationsConversationsCreateBody,
  type DashboardOrganizationsConversationsCreateOutput,
  type DashboardOrganizationsConversationsGetOutput,
  type DashboardOrganizationsConversationsListOutput,
  type DashboardOrganizationsConversationsListQuery,
  type DashboardOrganizationsConversationsUpdateBody,
  type DashboardOrganizationsConversationsUpdateOutput
} from '../resources';

/**
 * @name Assistants controller
 * @description Dashboard-only assistant and conversation endpoints
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationConversationsEndpoint {
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
   * @param `query` - DashboardOrganizationsConversationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConversationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardOrganizationsConversationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConversationsListOutput> {
    let path = `organization/instances/${instanceId}/conversations`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsConversationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConversationsListOutput
    );
  }

  /**
   * @name Create assistant conversation
   * @description Create a new assistant conversation in an instance.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardOrganizationsConversationsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConversationsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardOrganizationsConversationsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConversationsCreateOutput> {
    let path = `organization/instances/${instanceId}/conversations`;

    let request = {
      path,
      body: mapDashboardOrganizationsConversationsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsConversationsCreateOutput
    );
  }

  /**
   * @name Get assistant conversation
   * @description Get a specific assistant conversation.
   *
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConversationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    assistantConversationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConversationsGetOutput> {
    let path = `organization/instances/${instanceId}/conversations/${assistantConversationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConversationsGetOutput
    );
  }

  /**
   * @name Update assistant conversation
   * @description Update a specific assistant conversation.
   *
   * @param `instanceId` - string
   * @param `assistantConversationId` - string
   * @param `body` - DashboardOrganizationsConversationsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConversationsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    assistantConversationId: string,
    body: DashboardOrganizationsConversationsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConversationsUpdateOutput> {
    let path = `organization/instances/${instanceId}/conversations/${assistantConversationId}`;

    let request = {
      path,
      body: mapDashboardOrganizationsConversationsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardOrganizationsConversationsUpdateOutput
    );
  }
}
