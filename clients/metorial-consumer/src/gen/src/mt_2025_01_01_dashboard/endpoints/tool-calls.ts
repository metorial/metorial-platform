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
 * @description Tool calls represent individual tool invocations within a session. They track the input, output, and status of each tool execution.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialToolCallsEndpoint {
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
   * @name List all tool calls
   * @description Returns a paginated list of tool calls across all sessions.
   *
   * @param `query` - DashboardInstanceToolCallsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceToolCallsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceToolCallsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceToolCallsListOutput> {
    let path = 'tool-calls';

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
   * @description Retrieves a specific tool call by ID.
   *
   * @param `toolCallId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceToolCallsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    toolCallId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceToolCallsGetOutput> {
    let path = `tool-calls/${toolCallId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceToolCallsGetOutput);
  }

  /**
   * @name Create tool call
   * @description Creates a new tool call in a session by invoking a specific tool.
   *
   * @param `body` - DashboardInstanceToolCallsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceToolCallsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceToolCallsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceToolCallsCreateOutput> {
    let path = 'tool-calls';

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
