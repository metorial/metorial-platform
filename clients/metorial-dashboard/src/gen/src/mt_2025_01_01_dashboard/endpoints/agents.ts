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
export class MetorialAgentsEndpoint {
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
   * @param `query` - DashboardInstanceAgentsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceAgentsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentsListOutput> {
    let path = 'agents';

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
   * @param `agentId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    agentId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentsGetOutput> {
    let path = `agents/${agentId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentsGetOutput);
  }
}
