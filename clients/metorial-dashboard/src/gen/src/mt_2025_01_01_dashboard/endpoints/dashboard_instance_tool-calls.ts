import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceToolCallsCreateBody,
  mapDashboardInstanceToolCallsCreateOutput,
  mapDashboardInstanceToolCallsGetOutput,
  mapDashboardInstanceToolCallsListOutput,
  mapDashboardInstanceToolCallsListQuery,
  type DashboardInstanceToolCallsCreateBody,
  type DashboardInstanceToolCallsCreateOutput,
  type DashboardInstanceToolCallsGetOutput,
  type DashboardInstanceToolCallsListOutput,
  type DashboardInstanceToolCallsListQuery
} from '../resources';

/**
 * @name Tool Calls controller
 * @description A tool call is one invocation of a provider tool in a session, with its input, output, and status.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceToolCallsEndpoint {
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
   * @name List tool calls
   * @description Returns a paginated list of tool calls across all sessions.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceToolCallsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceToolCallsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceToolCallsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceToolCallsListOutput> {
    let path = `dashboard/instances/${instanceId}/tool-calls`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceToolCallsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceToolCallsListOutput
    );
  }

  /**
   * @name Get tool call
   * @description Retrieves a tool call.
   *
   * @param `instanceId` - string
   * @param `toolCallId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceToolCallsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    toolCallId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceToolCallsGetOutput> {
    let path = `dashboard/instances/${instanceId}/tool-calls/${toolCallId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceToolCallsGetOutput);
  }

  /**
   * @name Create tool call
   * @description Calls a tool in a session and returns the resulting tool call.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceToolCallsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceToolCallsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceToolCallsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceToolCallsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/tool-calls`;

    let request = {
      path,
      body: mapDashboardInstanceToolCallsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceToolCallsCreateOutput
    );
  }
}
