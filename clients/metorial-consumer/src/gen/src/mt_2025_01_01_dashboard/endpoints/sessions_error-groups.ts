import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsErrorGroupsGetOutput,
  mapDashboardInstanceSessionsErrorGroupsListOutput,
  mapDashboardInstanceSessionsErrorGroupsListQuery,
  type DashboardInstanceSessionsErrorGroupsGetOutput,
  type DashboardInstanceSessionsErrorGroupsListOutput,
  type DashboardInstanceSessionsErrorGroupsListQuery
} from '../resources';

/**
 * @name Session Error Groups controller
 * @description Session error groups aggregate similar errors that occurred during a session. This read-only resource helps identify patterns in errors.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsErrorGroupsEndpoint {
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
   * @name List session error groups
   * @description Returns a paginated list of error groups for a session.
   *
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsErrorGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsErrorGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    sessionId: string,
    query?: DashboardInstanceSessionsErrorGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsErrorGroupsListOutput> {
    let path = `sessions/${sessionId}/error-groups`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsErrorGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsErrorGroupsListOutput);
  }

  /**
   * @name Get session error group
   * @description Retrieves a specific error group for a session.
   *
   * @param `sessionId` - string
   * @param `sessionErrorGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsErrorGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    sessionErrorGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsErrorGroupsGetOutput> {
    let path = `sessions/${sessionId}/error-groups/${sessionErrorGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSessionsErrorGroupsGetOutput);
  }
}
