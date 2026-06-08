import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentsInstancesGetOutput,
  mapDashboardInstanceAgentsInstancesListOutput,
  mapDashboardInstanceAgentsInstancesListQuery,
  type DashboardInstanceAgentsInstancesGetOutput,
  type DashboardInstanceAgentsInstancesListOutput,
  type DashboardInstanceAgentsInstancesListQuery
} from '../resources';

/**
 * @name Agents controller
 * @description Inspect agents and their linked clients and instances.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentsInstancesEndpoint {
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
   * @name List agent instances
   * @description Returns a paginated list of instances for an agent.
   *
   * @param `instanceId` - string
   * @param `agentId` - string
   * @param `query` - DashboardInstanceAgentsInstancesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentsInstancesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    agentId: string,
    query?: DashboardInstanceAgentsInstancesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentsInstancesListOutput> {
    let path = `dashboard/instances/${instanceId}/agents/${agentId}/instances`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentsInstancesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentsInstancesListOutput
    );
  }

  /**
   * @name Get agent instance
   * @description Retrieves a specific agent instance by ID.
   *
   * @param `instanceId` - string
   * @param `agentId` - string
   * @param `agentInstanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentsInstancesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    agentId: string,
    agentInstanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentsInstancesGetOutput> {
    let path = `dashboard/instances/${instanceId}/agents/${agentId}/instances/${agentInstanceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentsInstancesGetOutput
    );
  }
}
