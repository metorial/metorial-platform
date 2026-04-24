import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerProvidersGroupsListOutput,
  mapConsumerProvidersGroupsListQuery,
  type ConsumerProvidersGroupsListOutput,
  type ConsumerProvidersGroupsListQuery
} from '../resources';

/**
 * @name Consumer Providers controller
 * @description Browse and configure portal providers from the consumer side.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerProvidersGroupsEndpoint {
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
   * @name List consumer provider groups
   * @description Returns the ordered provider groups for the current consumer surface.
   *
   * @param `query` - ConsumerProvidersGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProvidersGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerProvidersGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProvidersGroupsListOutput> {
    let path = 'consumer/providers/groups';

    let request = {
      path,

      query: query
        ? mapConsumerProvidersGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerProvidersGroupsListOutput);
  }
}
