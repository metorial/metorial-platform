import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionErrorGroupsGetOutput,
  mapDashboardInstanceSessionErrorGroupsListOutput,
  mapDashboardInstanceSessionErrorGroupsListQuery,
  type DashboardInstanceSessionErrorGroupsGetOutput,
  type DashboardInstanceSessionErrorGroupsListOutput,
  type DashboardInstanceSessionErrorGroupsListQuery
} from '../resources';

/**
 * @name Session Error Groups controller
 * @description Session error groups aggregate similar errors that occurred during a session. This read-only resource helps identify patterns in errors.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSessionErrorGroupsEndpoint {
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
   * @name List all session error groups
   * @description Returns a paginated list of error groups across all sessions.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceSessionErrorGroupsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionErrorGroupsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceSessionErrorGroupsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionErrorGroupsListOutput> {
    let path = `instances/${instanceId}/session-error-groups`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionErrorGroupsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionErrorGroupsListOutput
    );
  }

  /**
   * @name Get session error group
   * @description Retrieves a specific error group by ID across all sessions.
   *
   * @param `instanceId` - string
   * @param `sessionErrorGroupId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionErrorGroupsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    sessionErrorGroupId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionErrorGroupsGetOutput> {
    let path = `instances/${instanceId}/session-error-groups/${sessionErrorGroupId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionErrorGroupsGetOutput
    );
  }
}
