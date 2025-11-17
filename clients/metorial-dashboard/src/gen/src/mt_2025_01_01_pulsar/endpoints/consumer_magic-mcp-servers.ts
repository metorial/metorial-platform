import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerMagicMcpServersGetOutput,
  mapConsumerMagicMcpServersListOutput,
  mapConsumerMagicMcpServersListQuery,
  type ConsumerMagicMcpServersGetOutput,
  type ConsumerMagicMcpServersListOutput,
  type ConsumerMagicMcpServersListQuery
} from '../resources';

/**
 * @name Consumer Magic MCP Server controller
 * @description Before you can connect to an MCP server, you need to create a magic MCP server.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerMagicMcpServersEndpoint {
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
   * @name List magic MCP server
   * @description List all magic MCP server
   *
   * @param `query` - ConsumerMagicMcpServersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpServersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerMagicMcpServersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpServersListOutput> {
    let path = 'consumer/magic-mcp-servers';

    let request = {
      path,

      query: query
        ? mapConsumerMagicMcpServersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpServersListOutput);
  }

  /**
   * @name Get magic MCP server
   * @description Get the information of a specific magic MCP server
   *
   * @param `magicMcpServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpServersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    magicMcpServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpServersGetOutput> {
    let path = `consumer/magic-mcp-servers/${magicMcpServerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpServersGetOutput);
  }
}
