import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerMagicMcpTokensAddGroupsBody,
  mapConsumerMagicMcpTokensAddGroupsOutput,
  mapConsumerMagicMcpTokensCreateBody,
  mapConsumerMagicMcpTokensCreateOutput,
  mapConsumerMagicMcpTokensDeleteOutput,
  mapConsumerMagicMcpTokensGetOutput,
  mapConsumerMagicMcpTokensListOutput,
  mapConsumerMagicMcpTokensListQuery,
  mapConsumerMagicMcpTokensRemoveGroupsBody,
  mapConsumerMagicMcpTokensRemoveGroupsOutput,
  mapConsumerMagicMcpTokensUpdateBody,
  mapConsumerMagicMcpTokensUpdateOutput,
  type ConsumerMagicMcpTokensAddGroupsBody,
  type ConsumerMagicMcpTokensAddGroupsOutput,
  type ConsumerMagicMcpTokensCreateBody,
  type ConsumerMagicMcpTokensCreateOutput,
  type ConsumerMagicMcpTokensDeleteOutput,
  type ConsumerMagicMcpTokensGetOutput,
  type ConsumerMagicMcpTokensListOutput,
  type ConsumerMagicMcpTokensListQuery,
  type ConsumerMagicMcpTokensRemoveGroupsBody,
  type ConsumerMagicMcpTokensRemoveGroupsOutput,
  type ConsumerMagicMcpTokensUpdateBody,
  type ConsumerMagicMcpTokensUpdateOutput
} from '../resources';

/**
 * @name Consumer Magic MCP Token controller
 * @description Before you can connect to an MCP server, you need to create a magic MCP token.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerMagicMcpTokensEndpoint {
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
   * @name List magic MCP token
   * @description List all magic MCP token
   *
   * @param `query` - ConsumerMagicMcpTokensListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpTokensListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerMagicMcpTokensListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpTokensListOutput> {
    let path = 'consumer/magic-mcp-tokens';

    let request = {
      path,

      query: query
        ? mapConsumerMagicMcpTokensListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpTokensListOutput);
  }

  /**
   * @name Get magic MCP token
   * @description Get the information of a specific magic MCP token
   *
   * @param `magicMcpTokenId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpTokensGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    magicMcpTokenId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpTokensGetOutput> {
    let path = `consumer/magic-mcp-tokens/${magicMcpTokenId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerMagicMcpTokensGetOutput);
  }

  /**
   * @name Create magic MCP token
   * @description Create a new magic MCP token
   *
   * @param `body` - ConsumerMagicMcpTokensCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpTokensCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: ConsumerMagicMcpTokensCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpTokensCreateOutput> {
    let path = 'consumer/magic-mcp-tokens';

    let request = {
      path,
      body: mapConsumerMagicMcpTokensCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerMagicMcpTokensCreateOutput);
  }

  /**
   * @name Delete magic MCP token
   * @description Delete a specific magic MCP token
   *
   * @param `magicMcpTokenId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpTokensDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    magicMcpTokenId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpTokensDeleteOutput> {
    let path = `consumer/magic-mcp-tokens/${magicMcpTokenId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapConsumerMagicMcpTokensDeleteOutput
    );
  }

  /**
   * @name Update magic MCP token
   * @description Update the information of a specific magic MCP token
   *
   * @param `magicMcpTokenId` - string
   * @param `body` - ConsumerMagicMcpTokensUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpTokensUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    magicMcpTokenId: string,
    body: ConsumerMagicMcpTokensUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpTokensUpdateOutput> {
    let path = `consumer/magic-mcp-tokens/${magicMcpTokenId}`;

    let request = {
      path,
      body: mapConsumerMagicMcpTokensUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapConsumerMagicMcpTokensUpdateOutput
    );
  }

  /**
   * @name Add magic MCP groups to token
   * @description Add magic MCP groups to a specific magic MCP token
   *
   * @param `magicMcpTokenId` - string
   * @param `body` - ConsumerMagicMcpTokensAddGroupsBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpTokensAddGroupsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  addGroups(
    magicMcpTokenId: string,
    body: ConsumerMagicMcpTokensAddGroupsBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpTokensAddGroupsOutput> {
    let path = `consumer/magic-mcp-tokens/${magicMcpTokenId}/add-groups`;

    let request = {
      path,
      body: mapConsumerMagicMcpTokensAddGroupsBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerMagicMcpTokensAddGroupsOutput
    );
  }

  /**
   * @name Remove magic MCP groups from token
   * @description Remove magic MCP groups from a specific magic MCP token
   *
   * @param `magicMcpTokenId` - string
   * @param `body` - ConsumerMagicMcpTokensRemoveGroupsBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerMagicMcpTokensRemoveGroupsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  removeGroups(
    magicMcpTokenId: string,
    body: ConsumerMagicMcpTokensRemoveGroupsBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerMagicMcpTokensRemoveGroupsOutput> {
    let path = `consumer/magic-mcp-tokens/${magicMcpTokenId}/remove-groups`;

    let request = {
      path,
      body: mapConsumerMagicMcpTokensRemoveGroupsBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerMagicMcpTokensRemoveGroupsOutput
    );
  }
}
