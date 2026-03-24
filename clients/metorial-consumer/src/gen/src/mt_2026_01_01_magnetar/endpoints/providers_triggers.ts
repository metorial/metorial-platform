import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersTriggersGetOutput,
  mapDashboardInstanceProvidersTriggersListOutput,
  mapDashboardInstanceProvidersTriggersListQuery,
  type DashboardInstanceProvidersTriggersGetOutput,
  type DashboardInstanceProvidersTriggersListOutput,
  type DashboardInstanceProvidersTriggersListQuery
} from '../resources';

/**
 * @name Provider Triggers controller
 * @description A provider trigger describes an event source a provider can emit for callbacks. Use triggers to discover which callback subscriptions a provider version supports.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProvidersTriggersEndpoint {
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
   * @name List provider triggers
   * @description Returns a paginated list of provider triggers for a specific provider version.
   *
   * @param `query` - DashboardInstanceProvidersTriggersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersTriggersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProvidersTriggersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersTriggersListOutput> {
    let path = 'provider-triggers';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProvidersTriggersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersTriggersListOutput
    );
  }

  /**
   * @name Get provider trigger
   * @description Retrieves a specific provider trigger by ID.
   *
   * @param `providerTriggerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersTriggersGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerTriggerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersTriggersGetOutput> {
    let path = `provider-triggers/${providerTriggerId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProvidersTriggersGetOutput
    );
  }
}
