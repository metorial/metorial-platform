import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerServerRequestsCreateBody,
  mapConsumerServerRequestsCreateOutput,
  mapConsumerServerRequestsGetOutput,
  mapConsumerServerRequestsListOutput,
  mapConsumerServerRequestsListQuery,
  type ConsumerServerRequestsCreateBody,
  type ConsumerServerRequestsCreateOutput,
  type ConsumerServerRequestsGetOutput,
  type ConsumerServerRequestsListOutput,
  type ConsumerServerRequestsListQuery
} from '../resources';

/**
 * @name Consumer Session controller
 * @description
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerServerRequestsEndpoint {
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
   * @name
   * @description
   *
   * @param `body` - ConsumerServerRequestsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerServerRequestsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: ConsumerServerRequestsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerServerRequestsCreateOutput> {
    let path = 'consumer/server-requests';

    let request = {
      path,
      body: mapConsumerServerRequestsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerServerRequestsCreateOutput);
  }

  /**
   * @name
   * @description
   *
   * @param `query` - ConsumerServerRequestsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerServerRequestsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerServerRequestsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerServerRequestsListOutput> {
    let path = 'consumer/server-requests';

    let request = {
      path,

      query: query
        ? mapConsumerServerRequestsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerServerRequestsListOutput);
  }

  /**
   * @name
   * @description
   *
   * @param `consumerServerRequestId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerServerRequestsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    consumerServerRequestId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerServerRequestsGetOutput> {
    let path = `consumer/server-requests/${consumerServerRequestId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerServerRequestsGetOutput);
  }
}
