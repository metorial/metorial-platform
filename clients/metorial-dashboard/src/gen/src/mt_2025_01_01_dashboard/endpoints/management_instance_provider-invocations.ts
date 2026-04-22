import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderInvocationsGetOutput,
  mapDashboardInstanceProviderInvocationsListOutput,
  mapDashboardInstanceProviderInvocationsListQuery,
  type DashboardInstanceProviderInvocationsGetOutput,
  type DashboardInstanceProviderInvocationsListOutput,
  type DashboardInstanceProviderInvocationsListQuery
} from '../resources';

/**
 * @name Provider Invocations controller
 * @description Provider invocations expose normalized provider-side tracing for tool calls, OAuth flows, and auth config events across Shuttle and Slates.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProviderInvocationsEndpoint {
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
   * @name Get provider invocation
   * @description Returns a single normalized provider invocation by ID.
   *
   * @param `instanceId` - string
   * @param `providerInvocationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderInvocationsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    providerInvocationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderInvocationsGetOutput> {
    let path = `instances/${instanceId}/provider-invocations/${providerInvocationId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderInvocationsGetOutput
    );
  }

  /**
   * @name List provider invocations
   * @description Returns normalized provider invocations and their logs for dashboard diagnostics.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProviderInvocationsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderInvocationsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProviderInvocationsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderInvocationsListOutput> {
    let path = `instances/${instanceId}/provider-invocations`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderInvocationsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderInvocationsListOutput
    );
  }
}
