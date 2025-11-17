import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerMagicMcpGroupsGetOutput,
  mapConsumerMagicMcpGroupsListOutput,
  mapConsumerMagicMcpGroupsListQuery,
  type ConsumerMagicMcpGroupsGetOutput,
  type ConsumerMagicMcpGroupsListOutput,
  type ConsumerMagicMcpGroupsListQuery
} from '../resources';

/**
 * @name Consumer Magic MCP Group controller
 * @description Before you can connect to an MCP server, you need to create a magic MCP group.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerMagicMcpGroupsEndpoint {
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
   * @name List magic MCP group
   * @description List all magic MCP group
   *
   * @param `query` - ConsumerMagicMcpGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerMagicMcpGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpGroupsListOutput> {
    let path = 'consumer/magic-mcp-groups';

    let request = {
      path,

      query: query
        ? mapConsumerMagicMcpGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpGroupsListOutput);
  }

  /**
   * @name Get magic MCP group
   * @description Get the information of a specific magic MCP group
   *
   * @param `magicMcpGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    magicMcpGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpGroupsGetOutput> {
    let path = `consumer/magic-mcp-groups/${magicMcpGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpGroupsGetOutput);
  }
}
