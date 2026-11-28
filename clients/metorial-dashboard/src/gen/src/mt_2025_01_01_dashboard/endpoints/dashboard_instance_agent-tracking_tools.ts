import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAgentTrackingToolsMcpServersOutput,
  mapDashboardInstanceAgentTrackingToolsMcpServersQuery,
  mapDashboardInstanceAgentTrackingToolsProviderCallsOutput,
  mapDashboardInstanceAgentTrackingToolsProviderCallsQuery,
  mapDashboardInstanceAgentTrackingToolsSkillsOutput,
  mapDashboardInstanceAgentTrackingToolsSkillsQuery,
  type DashboardInstanceAgentTrackingToolsMcpServersOutput,
  type DashboardInstanceAgentTrackingToolsMcpServersQuery,
  type DashboardInstanceAgentTrackingToolsProviderCallsOutput,
  type DashboardInstanceAgentTrackingToolsProviderCallsQuery,
  type DashboardInstanceAgentTrackingToolsSkillsOutput,
  type DashboardInstanceAgentTrackingToolsSkillsQuery
} from '../resources';

/**
 * @name Agent Tracking Tools controller
 * @description Agent tracking tools are the skills and MCP servers AI coding agents used, as their telemetry reports them. Claude Code sends custom skill and MCP server names only with Detailed Tool Reporting on.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAgentTrackingToolsEndpoint {
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
   * @name Get skill usage
   * @description Returns how often each skill was activated over a range and by how many members, with the totals of the range. Refused when the organization hides individual data. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingToolsSkillsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingToolsSkillsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  skills(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingToolsSkillsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingToolsSkillsOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/agent-tracking/tools/skills`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingToolsSkillsQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAgentTrackingToolsSkillsOutput);
  }

  /**
   * @name Get MCP server usage
   * @description Returns the calls, failures and members of each MCP server and its tools over a range, with the totals of the range. Refused when the organization hides individual data. Results can be up to a minute old.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingToolsMcpServersQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingToolsMcpServersOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  mcpServers(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingToolsMcpServersQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingToolsMcpServersOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/agent-tracking/tools/mcp-servers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingToolsMcpServersQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingToolsMcpServersOutput
    );
  }

  /**
   * @name Get agent provider calls
   * @description Returns the MCP tool calls of Claude Code and Codex that reached Metorial providers over a range, with failures, by repository, member or client. Refused when the organization hides individual data.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAgentTrackingToolsProviderCallsQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAgentTrackingToolsProviderCallsOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  providerCalls(
    instanceId: string,
    query?: DashboardInstanceAgentTrackingToolsProviderCallsQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAgentTrackingToolsProviderCallsOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/agent-tracking/tools/provider-calls`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAgentTrackingToolsProviderCallsQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAgentTrackingToolsProviderCallsOutput
    );
  }
}
