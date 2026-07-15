import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerAgentsGetOutput,
  mapConsumerAgentsListOutput,
  mapConsumerAgentsListQuery,
  type ConsumerAgentsGetOutput,
  type ConsumerAgentsListOutput,
  type ConsumerAgentsListQuery
} from '../resources';

/**
 * @name Consumer Activity controller
 * @description Inspect runtime clients, connections, operations, and credentials for the authenticated consumer profile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerAgentsEndpoint {
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
   * @name List consumer runtime clients
   * @description Returns MCP clients observed in Magic MCP sessions accessible to the authenticated profile.
   *
   * @param `query` - ConsumerAgentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerAgentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerAgentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerAgentsListOutput> {
    let path = 'consumer/agents';

    let request = {
      path,

      query: query ? mapConsumerAgentsListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerAgentsListOutput);
  }

  /**
   * @name Get consumer runtime client
   * @description Retrieves one MCP client observed in an accessible Magic MCP session.
   *
   * @param `agentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerAgentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    agentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerAgentsGetOutput> {
    let path = `consumer/agents/${agentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerAgentsGetOutput);
  }
}
