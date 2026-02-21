import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsErrorsGetOutput,
  mapDashboardInstanceSessionsErrorsListOutput,
  mapDashboardInstanceSessionsErrorsListQuery,
  type DashboardInstanceSessionsErrorsGetOutput,
  type DashboardInstanceSessionsErrorsListOutput,
  type DashboardInstanceSessionsErrorsListQuery
} from '../resources';

/**
 * @name Session Errors controller
 * @description Session errors track errors that occurred during a session. This read-only resource provides visibility into issues that happened during provider execution.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionsErrorsEndpoint {
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
   * @name List session errors
   * @description Returns a paginated list of errors that occurred in a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsErrorsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsErrorsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    sessionId: string,
    query?: DashboardInstanceSessionsErrorsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsErrorsListOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}/errors`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsErrorsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsErrorsListOutput
    );
  }

  /**
   * @name Get session error
   * @description Retrieves a specific error that occurred in a session.
   *
   * @param `instanceId` - string
   * @param `sessionId` - string
   * @param `sessionErrorId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsErrorsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionId: string,
    sessionErrorId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsErrorsGetOutput> {
    let path = `instances/${instanceId}/sessions/${sessionId}/errors/${sessionErrorId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsErrorsGetOutput
    );
  }
}
