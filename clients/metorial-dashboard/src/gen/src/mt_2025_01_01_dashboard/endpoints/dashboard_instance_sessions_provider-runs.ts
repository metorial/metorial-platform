import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsProviderRunsGetLogsOutput,
  mapDashboardInstanceSessionsProviderRunsGetOutput,
  mapDashboardInstanceSessionsProviderRunsListOutput,
  mapDashboardInstanceSessionsProviderRunsListQuery,
  type DashboardInstanceSessionsProviderRunsGetLogsOutput,
  type DashboardInstanceSessionsProviderRunsGetOutput,
  type DashboardInstanceSessionsProviderRunsListOutput,
  type DashboardInstanceSessionsProviderRunsListQuery
} from '../resources';

/**
 * @name Provider Runs controller
 * @description Provider runs track the execution of provider operations within a session. This read-only resource provides visibility into provider activity.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSessionsProviderRunsEndpoint {
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
   * @description Returns a paginated list of provider runs for a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsProviderRunsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProviderRunsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    query?: DashboardInstanceSessionsProviderRunsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProviderRunsListOutput> {
    let path = `dashboard/instances/${instanceId}/sessions/${sessionId}/provider-runs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsProviderRunsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsProviderRunsListOutput);
  }

  /**
   * @name Get provider run
   * @description Retrieves a specific provider run for a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `providerRunId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProviderRunsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionId: string,
    providerRunId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProviderRunsGetOutput> {
    let path = `dashboard/instances/${instanceId}/sessions/${sessionId}/provider-runs/${providerRunId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsProviderRunsGetOutput);
  }

  /**
   * @name Get provider run logs
   * @description Retrieves the logs for a specific provider run.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `providerRunId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsProviderRunsGetLogsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  getLogs(
    instanceId: string,
    sessionId: string,
    providerRunId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsProviderRunsGetLogsOutput> {
    let path = `dashboard/instances/${instanceId}/sessions/${sessionId}/provider-runs/${providerRunId}/logs`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsProviderRunsGetLogsOutput);
  }
}
