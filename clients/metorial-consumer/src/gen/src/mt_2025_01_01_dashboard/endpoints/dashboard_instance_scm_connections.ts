import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceScmConnectionsCreateBody,
  mapDashboardInstanceScmConnectionsCreateOutput,
  mapDashboardInstanceScmConnectionsGetOutput,
  mapDashboardInstanceScmConnectionsListOutput,
  mapDashboardInstanceScmConnectionsListQuery,
  type DashboardInstanceScmConnectionsCreateBody,
  type DashboardInstanceScmConnectionsCreateOutput,
  type DashboardInstanceScmConnectionsGetOutput,
  type DashboardInstanceScmConnectionsListOutput,
  type DashboardInstanceScmConnectionsListQuery
} from '../resources';

/**
 * @name SCM Connections controller
 * @description Manage source control connections for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceScmConnectionsEndpoint {
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
   * @name List SCM connections
   * @description Returns a paginated list of SCM connections.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceScmConnectionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmConnectionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceScmConnectionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmConnectionsListOutput> {
    let path = `dashboard/instances/${instanceId}/scm/connections`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceScmConnectionsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceScmConnectionsListOutput
    );
  }

  /**
   * @name Get SCM connection
   * @description Retrieves a specific SCM connection by ID.
   *
   * @param `instanceId` - string
   * @param `scmConnectionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmConnectionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    scmConnectionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmConnectionsGetOutput> {
    let path = `dashboard/instances/${instanceId}/scm/connections/${scmConnectionId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceScmConnectionsGetOutput
    );
  }

  /**
   * @name Create SCM connection
   * @description Initiates an SCM connection setup session.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceScmConnectionsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmConnectionsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    instanceId: string,
    body: DashboardInstanceScmConnectionsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmConnectionsCreateOutput> {
    let path = `dashboard/instances/${instanceId}/scm/connections`;

    let request = {
      path,
      body: mapDashboardInstanceScmConnectionsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceScmConnectionsCreateOutput
    );
  }
}
