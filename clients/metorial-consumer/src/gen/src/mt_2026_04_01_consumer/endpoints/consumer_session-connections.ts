import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerSessionConnectionsGetOutput,
  mapConsumerSessionConnectionsListOutput,
  mapConsumerSessionConnectionsListQuery,
  type ConsumerSessionConnectionsGetOutput,
  type ConsumerSessionConnectionsListOutput,
  type ConsumerSessionConnectionsListQuery
} from '../resources';

/**
 * @name Consumer Activity controller
 * @description Inspect runtime clients, connections, operations, and credentials for the authenticated consumer profile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerSessionConnectionsEndpoint {
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
   * @name List consumer session connections
   * @description Returns connections from Magic MCP sessions accessible to the authenticated profile.
   *
   * @param `query` - ConsumerSessionConnectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerSessionConnectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerSessionConnectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerSessionConnectionsListOutput> {
    let path = 'consumer/session-connections';

    let request = {
      path,

      query: query
        ? mapConsumerSessionConnectionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerSessionConnectionsListOutput
    );
  }

  /**
   * @name Get consumer session connection
   * @description Retrieves one connection from a Magic MCP session accessible to the authenticated profile.
   *
   * @param `sessionConnectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerSessionConnectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionConnectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerSessionConnectionsGetOutput> {
    let path = `consumer/session-connections/${sessionConnectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerSessionConnectionsGetOutput);
  }
}
