import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatWorkspacesGetOutput,
  mapDashboardInstanceChatWorkspacesGetQuery,
  mapDashboardInstanceChatWorkspacesListOutput,
  mapDashboardInstanceChatWorkspacesListQuery,
  type DashboardInstanceChatWorkspacesGetOutput,
  type DashboardInstanceChatWorkspacesGetQuery,
  type DashboardInstanceChatWorkspacesListOutput,
  type DashboardInstanceChatWorkspacesListQuery
} from '../resources';

/**
 * @name Chat Workspaces controller
 * @description Chat workspaces group channels together, for chat providers that organize conversations that way.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceChatWorkspacesEndpoint {
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
   * @name List chat workspaces
   * @description Returns a paginated list of workspaces for a chat instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceChatWorkspacesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatWorkspacesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceChatWorkspacesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatWorkspacesListOutput> {
    let path = `instances/${instanceId}/chat/workspaces`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatWorkspacesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatWorkspacesListOutput
    );
  }

  /**
   * @name Get chat workspace
   * @description Retrieves a specific chat workspace.
   *
   * @param `instanceId` - string
   * @param `chatWorkspaceId` - string
   * @param `query` - DashboardInstanceChatWorkspacesGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatWorkspacesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatWorkspaceId: string,
    query?: DashboardInstanceChatWorkspacesGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatWorkspacesGetOutput> {
    let path = `instances/${instanceId}/chat/workspaces/${chatWorkspaceId}`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatWorkspacesGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatWorkspacesGetOutput
    );
  }
}
