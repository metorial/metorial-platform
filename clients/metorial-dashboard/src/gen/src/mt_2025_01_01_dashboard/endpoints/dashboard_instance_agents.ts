import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentsGetOutput,
  mapDashboardInstanceAgentsListOutput,
  mapDashboardInstanceAgentsListQuery,
  type DashboardInstanceAgentsGetOutput,
  type DashboardInstanceAgentsListOutput,
  type DashboardInstanceAgentsListQuery
} from '../resources';

/**
 * @name Agents controller
 * @description Inspect agents and their linked clients and instances.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentsEndpoint {
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
   * @name List agents
   * @description Returns a paginated list of agents for the instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAgentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentsListOutput> {
    let path = `dashboard/instances/${instanceId}/agents`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentsListOutput);
  }

  /**
   * @name Get agent
   * @description Retrieves a specific agent by ID.
   *
   * @param `instanceId` - string
   * @param `agentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    agentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentsGetOutput> {
    let path = `dashboard/instances/${instanceId}/agents/${agentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentsGetOutput);
  }
}
