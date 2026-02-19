import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsCreateBody,
  mapDashboardInstanceSessionsCreateOutput,
  mapDashboardInstanceSessionsDeleteOutput,
  mapDashboardInstanceSessionsGetOutput,
  mapDashboardInstanceSessionsListOutput,
  mapDashboardInstanceSessionsListQuery,
  mapDashboardInstanceSessionsUpdateBody,
  mapDashboardInstanceSessionsUpdateOutput,
  type DashboardInstanceSessionsCreateBody,
  type DashboardInstanceSessionsCreateOutput,
  type DashboardInstanceSessionsDeleteOutput,
  type DashboardInstanceSessionsGetOutput,
  type DashboardInstanceSessionsListOutput,
  type DashboardInstanceSessionsListQuery,
  type DashboardInstanceSessionsUpdateBody,
  type DashboardInstanceSessionsUpdateOutput
} from '../resources';

/**
 * @name Sessions controller
 * @description Sessions are connections to providers that allow clients to interact with MCP servers. Each session can include one or more provider deployments.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionsEndpoint {
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
   * @name List sessions
   * @description Returns a paginated list of sessions.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsListOutput> {
    let path = `instances/${instanceId}/sessions`;

    let request = {
      path,

      query: query ? mapDashboardInstanceSessionsListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsListOutput);
  }

  /**
   * @name Get session
   * @description Retrieves a specific session by ID.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsGetOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsGetOutput);
  }

  /**
   * @name Create session
   * @description Creates a new session with provider deployments.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceSessionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceSessionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsCreateOutput> {
    let path = `instances/${instanceId}/sessions`;

    let request = {
      path,
      body: mapDashboardInstanceSessionsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceSessionsCreateOutput);
  }

  /**
   * @name Update session
   * @description Updates a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `body` - DashboardInstanceSessionsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    sessionId: string,
    body: DashboardInstanceSessionsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsUpdateOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}`;

    let request = {
      path,
      body: mapDashboardInstanceSessionsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(mapDashboardInstanceSessionsUpdateOutput);
  }

  /**
   * @name Delete session
   * @description Deletes a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    sessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsDeleteOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(mapDashboardInstanceSessionsDeleteOutput);
  }
}
