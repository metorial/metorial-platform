import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerProfileGroupsListOutput,
  mapConsumerProfileGroupsListQuery,
  type ConsumerProfileGroupsListOutput,
  type ConsumerProfileGroupsListQuery
} from '../resources';

/**
 * @name Consumer Session controller
 * @description Inspect the authenticated consumer session and profile.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerProfileGroupsEndpoint {
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
   * @name List consumer profile groups
   * @description Returns the effective groups for the authenticated consumer profile.
   *
   * @param `query` - ConsumerProfileGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerProfileGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerProfileGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerProfileGroupsListOutput> {
    let path = 'consumer/profile/groups';

    let request = {
      path,

      query: query
        ? mapConsumerProfileGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerProfileGroupsListOutput);
  }
}
