import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerToolCallsGetOutput,
  mapConsumerToolCallsListOutput,
  mapConsumerToolCallsListQuery,
  type ConsumerToolCallsGetOutput,
  type ConsumerToolCallsListOutput,
  type ConsumerToolCallsListQuery
} from '../resources';

/**
 * @name Consumer Activity controller
 * @description Inspect runtime clients, connections, operations, and credentials for the authenticated consumer profile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerToolCallsEndpoint {
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
   * @name List consumer tool calls
   * @description Returns read-only tool-call activity for identities owned by the authenticated profile actor.
   *
   * @param `query` - ConsumerToolCallsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerToolCallsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerToolCallsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerToolCallsListOutput> {
    let path = 'consumer/tool-calls';

    let request = {
      path,

      query: query
        ? mapConsumerToolCallsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerToolCallsListOutput);
  }

  /**
   * @name Get consumer tool call
   * @description Retrieves one tool call belonging to an identity owned by the authenticated profile actor.
   *
   * @param `toolCallId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerToolCallsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    toolCallId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerToolCallsGetOutput> {
    let path = `consumer/tool-calls/${toolCallId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerToolCallsGetOutput);
  }
}
