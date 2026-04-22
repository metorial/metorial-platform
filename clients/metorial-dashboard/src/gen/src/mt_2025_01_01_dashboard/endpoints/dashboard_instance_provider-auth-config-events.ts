import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderAuthConfigEventsGetOutput,
  mapDashboardInstanceProviderAuthConfigEventsListOutput,
  mapDashboardInstanceProviderAuthConfigEventsListQuery,
  type DashboardInstanceProviderAuthConfigEventsGetOutput,
  type DashboardInstanceProviderAuthConfigEventsListOutput,
  type DashboardInstanceProviderAuthConfigEventsListQuery
} from '../resources';

/**
 * @name Provider Auth Config Events controller
 * @description Provider auth config events describe OAuth setup progress, token refreshes, and provider-side authentication lifecycle changes.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceProviderAuthConfigEventsEndpoint {
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
   * @name List provider auth config events
   * @description Returns a paginated list of provider auth config events for dashboard diagnostics.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderAuthConfigEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderAuthConfigEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderAuthConfigEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderAuthConfigEventsListOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-events`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderAuthConfigEventsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderAuthConfigEventsListOutput
    );
  }

  /**
   * @name Get provider auth config event
   * @description Retrieves a specific provider auth config event by ID.
   *
   * @param `instanceId` - string
   * @param `providerAuthConfigEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderAuthConfigEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerAuthConfigEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderAuthConfigEventsGetOutput> {
    let path = `dashboard/instances/${instanceId}/provider-auth-config-events/${providerAuthConfigEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderAuthConfigEventsGetOutput
    );
  }
}
