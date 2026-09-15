import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatConnectionsCreateBody,
  mapDashboardInstanceChatConnectionsCreateOutput,
  mapDashboardInstanceChatConnectionsDeleteOutput,
  mapDashboardInstanceChatConnectionsGetOutput,
  mapDashboardInstanceChatConnectionsListOutput,
  mapDashboardInstanceChatConnectionsListQuery,
  mapDashboardInstanceChatConnectionsUpdateBody,
  mapDashboardInstanceChatConnectionsUpdateOutput,
  type DashboardInstanceChatConnectionsCreateBody,
  type DashboardInstanceChatConnectionsCreateOutput,
  type DashboardInstanceChatConnectionsDeleteOutput,
  type DashboardInstanceChatConnectionsGetOutput,
  type DashboardInstanceChatConnectionsListOutput,
  type DashboardInstanceChatConnectionsListQuery,
  type DashboardInstanceChatConnectionsUpdateBody,
  type DashboardInstanceChatConnectionsUpdateOutput
} from '../resources';

/**
 * @name Chat Connections controller
 * @description Chat connections link a chat provider, such as Slack or Microsoft Teams, to your instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceChatConnectionsEndpoint {
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
   * @name List chat connections
   * @description Returns a paginated list of chat connections.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceChatConnectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatConnectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceChatConnectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatConnectionsListOutput> {
    let path = `instances/${instanceId}/chat/connections`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatConnectionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatConnectionsListOutput
    );
  }

  /**
   * @name Get chat connection
   * @description Retrieves a specific chat connection.
   *
   * @param `instanceId` - string
   * @param `chatConnectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatConnectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatConnectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatConnectionsGetOutput> {
    let path = `instances/${instanceId}/chat/connections/${chatConnectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatConnectionsGetOutput
    );
  }

  /**
   * @name Create chat connection
   * @description Creates a new chat connection, together with the single provider it is linked to.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceChatConnectionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatConnectionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceChatConnectionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatConnectionsCreateOutput> {
    let path = `instances/${instanceId}/chat/connections`;

    let request = {
      path,
      body: mapDashboardInstanceChatConnectionsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatConnectionsCreateOutput
    );
  }

  /**
   * @name Update chat connection
   * @description Updates a specific chat connection.
   *
   * @param `instanceId` - string
   * @param `chatConnectionId` - string
   * @param `body` - DashboardInstanceChatConnectionsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatConnectionsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    chatConnectionId: string,
    body: DashboardInstanceChatConnectionsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatConnectionsUpdateOutput> {
    let path = `instances/${instanceId}/chat/connections/${chatConnectionId}`;

    let request = {
      path,
      body: mapDashboardInstanceChatConnectionsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceChatConnectionsUpdateOutput
    );
  }

  /**
   * @name Delete chat connection
   * @description Archives a specific chat connection.
   *
   * @param `instanceId` - string
   * @param `chatConnectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatConnectionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    chatConnectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatConnectionsDeleteOutput> {
    let path = `instances/${instanceId}/chat/connections/${chatConnectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceChatConnectionsDeleteOutput
    );
  }
}
