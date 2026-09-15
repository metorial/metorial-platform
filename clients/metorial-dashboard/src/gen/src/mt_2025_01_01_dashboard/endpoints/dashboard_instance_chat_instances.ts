import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceChatInstancesCreateBody,
  mapDashboardInstanceChatInstancesCreateOutput,
  mapDashboardInstanceChatInstancesDeleteOutput,
  mapDashboardInstanceChatInstancesGetOutput,
  mapDashboardInstanceChatInstancesListOutput,
  mapDashboardInstanceChatInstancesListQuery,
  mapDashboardInstanceChatInstancesSyncOutput,
  mapDashboardInstanceChatInstancesUpdateBody,
  mapDashboardInstanceChatInstancesUpdateOutput,
  type DashboardInstanceChatInstancesCreateBody,
  type DashboardInstanceChatInstancesCreateOutput,
  type DashboardInstanceChatInstancesDeleteOutput,
  type DashboardInstanceChatInstancesGetOutput,
  type DashboardInstanceChatInstancesListOutput,
  type DashboardInstanceChatInstancesListQuery,
  type DashboardInstanceChatInstancesSyncOutput,
  type DashboardInstanceChatInstancesUpdateBody,
  type DashboardInstanceChatInstancesUpdateOutput
} from '../resources';

/**
 * @name Chat Instances controller
 * @description Chat instances materialize a chat connection for a specific runtime configuration.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceChatInstancesEndpoint {
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
   * @name List chat instances
   * @description Returns a paginated list of chat instances.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceChatInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceChatInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesListOutput> {
    let path = `dashboard/instances/${instanceId}/chat/instances`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceChatInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatInstancesListOutput
    );
  }

  /**
   * @name Get chat instance
   * @description Retrieves a specific chat instance.
   *
   * @param `instanceId` - string
   * @param `chatInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    chatInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesGetOutput> {
    let path = `dashboard/instances/${instanceId}/chat/instances/${chatInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceChatInstancesGetOutput
    );
  }

  /**
   * @name Create chat instance
   * @description Creates a new chat instance for a chat connection.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceChatInstancesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceChatInstancesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesCreateOutput> {
    let path = `dashboard/instances/${instanceId}/chat/instances`;

    let request = {
      path,
      body: mapDashboardInstanceChatInstancesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatInstancesCreateOutput
    );
  }

  /**
   * @name Update chat instance
   * @description Updates a specific chat instance.
   *
   * @param `instanceId` - string
   * @param `chatInstanceId` - string
   * @param `body` - DashboardInstanceChatInstancesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    chatInstanceId: string,
    body: DashboardInstanceChatInstancesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/chat/instances/${chatInstanceId}`;

    let request = {
      path,
      body: mapDashboardInstanceChatInstancesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceChatInstancesUpdateOutput
    );
  }

  /**
   * @name Delete chat instance
   * @description Archives a specific chat instance.
   *
   * @param `instanceId` - string
   * @param `chatInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    chatInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/chat/instances/${chatInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceChatInstancesDeleteOutput
    );
  }

  /**
   * @name Sync chat instance
   * @description Triggers a sync of the workspaces available on this chat instance.
   *
   * @param `instanceId` - string
   * @param `chatInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceChatInstancesSyncOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  sync(
    instanceId: string,
    chatInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceChatInstancesSyncOutput> {
    let path = `dashboard/instances/${instanceId}/chat/instances/${chatInstanceId}/sync`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceChatInstancesSyncOutput
    );
  }
}
