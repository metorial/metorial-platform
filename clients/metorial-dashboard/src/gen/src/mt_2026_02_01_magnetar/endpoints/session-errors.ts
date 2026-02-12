import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionErrorsListOutput,
  mapDashboardInstanceSessionErrorsListQuery,
  type DashboardInstanceSessionErrorsListOutput,
  type DashboardInstanceSessionErrorsListQuery
} from '../resources';

/**
 * @name Session Errors controller
 * @description Session errors track errors that occurred during a session. This read-only resource provides visibility into issues that happened during provider execution.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionErrorsEndpoint {
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
   * @name List all session errors
   * @description Returns a paginated list of errors across all sessions.
   *
   * @param `query` - DashboardInstanceSessionErrorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionErrorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSessionErrorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionErrorsListOutput> {
    let path = 'session-errors';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionErrorsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionErrorsListOutput
    );
  }
}
