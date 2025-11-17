import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerMagicMcpSessionsGetOutput,
  mapConsumerMagicMcpSessionsListOutput,
  mapConsumerMagicMcpSessionsListQuery,
  type ConsumerMagicMcpSessionsGetOutput,
  type ConsumerMagicMcpSessionsListOutput,
  type ConsumerMagicMcpSessionsListQuery
} from '../resources';

/**
 * @name Consumer Magic MCP Session controller
 * @description Magic MCP sessions are created when a user connects to a magic MCP session using a valid magic MCP token.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerMagicMcpSessionsEndpoint {
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
   * @name List magic MCP session
   * @description List all magic MCP session
   *
   * @param `query` - ConsumerMagicMcpSessionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpSessionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerMagicMcpSessionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpSessionsListOutput> {
    let path = 'consumer/magic-mcp-sessions';

    let request = {
      path,

      query: query
        ? mapConsumerMagicMcpSessionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpSessionsListOutput);
  }

  /**
   * @name Get magic MCP session
   * @description Get the information of a specific magic MCP session
   *
   * @param `magicMcpSessionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpSessionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    magicMcpSessionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpSessionsGetOutput> {
    let path = `consumer/magic-mcp-sessions/${magicMcpSessionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpSessionsGetOutput);
  }
}
