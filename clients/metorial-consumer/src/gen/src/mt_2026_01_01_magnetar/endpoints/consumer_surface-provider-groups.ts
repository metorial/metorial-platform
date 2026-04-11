import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerSurfaceProviderGroupsGetOutput,
  mapConsumerSurfaceProviderGroupsListOutput,
  mapConsumerSurfaceProviderGroupsListQuery,
  type ConsumerSurfaceProviderGroupsGetOutput,
  type ConsumerSurfaceProviderGroupsListOutput,
  type ConsumerSurfaceProviderGroupsListQuery
} from '../resources';

/**
 * @name Consumer Providers controller
 * @description Browse and configure portal providers from the consumer side.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerSurfaceProviderGroupsEndpoint {
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
   * @name List consumer surface provider groups
   * @description Returns a paginated list of provider groups for the consumer surface, ordered by index.
   *
   * @param `query` - ConsumerSurfaceProviderGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerSurfaceProviderGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerSurfaceProviderGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerSurfaceProviderGroupsListOutput> {
    let path = 'consumer/surface-provider-groups';

    let request = {
      path,

      query: query
        ? mapConsumerSurfaceProviderGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerSurfaceProviderGroupsListOutput
    );
  }

  /**
   * @name Get consumer surface provider group
   * @description Retrieves a specific surface provider group by ID.
   *
   * @param `consumerSurfaceProviderGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerSurfaceProviderGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    consumerSurfaceProviderGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerSurfaceProviderGroupsGetOutput> {
    let path = `consumer/surface-provider-groups/${consumerSurfaceProviderGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapConsumerSurfaceProviderGroupsGetOutput
    );
  }
}
