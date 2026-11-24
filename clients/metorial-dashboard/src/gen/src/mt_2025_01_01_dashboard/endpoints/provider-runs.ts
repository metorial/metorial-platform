import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProviderRunsGetLogsOutput,
  mapDashboardInstanceProviderRunsGetOutput,
  mapDashboardInstanceProviderRunsListOutput,
  mapDashboardInstanceProviderRunsListQuery,
  type DashboardInstanceProviderRunsGetLogsOutput,
  type DashboardInstanceProviderRunsGetOutput,
  type DashboardInstanceProviderRunsListOutput,
  type DashboardInstanceProviderRunsListQuery
} from '../resources';

/**
 * @name Provider Runs controller
 * @description A provider run is one execution of a provider in a session. Runs track activity from start to completion.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProviderRunsEndpoint {
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
   * @name List provider runs
   * @description Returns a paginated list of provider runs across all sessions.
   *
   * @param `query` - DashboardInstanceProviderRunsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderRunsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceProviderRunsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderRunsListOutput> {
    let path = 'provider-runs';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProviderRunsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderRunsListOutput
    );
  }

  /**
   * @name Get provider run
   * @description Retrieves a provider run.
   *
   * @param `providerRunId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderRunsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    providerRunId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderRunsGetOutput> {
    let path = `provider-runs/${encodeURIComponent(providerRunId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderRunsGetOutput
    );
  }

  /**
   * @name Get provider run logs
   * @description Retrieves the logs for a provider run.
   *
   * @param `providerRunId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProviderRunsGetLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getLogs(
    providerRunId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProviderRunsGetLogsOutput> {
    let path = `provider-runs/${encodeURIComponent(providerRunId)}/logs`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProviderRunsGetLogsOutput
    );
  }
}
