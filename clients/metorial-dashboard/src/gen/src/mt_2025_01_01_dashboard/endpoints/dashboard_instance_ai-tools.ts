import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiToolsGetOutput,
  mapDashboardInstanceAiToolsListOutput,
  mapDashboardInstanceAiToolsListQuery,
  type DashboardInstanceAiToolsGetOutput,
  type DashboardInstanceAiToolsListOutput,
  type DashboardInstanceAiToolsListQuery
} from '../resources';

/**
 * @name AI Tools controller
 * @description An AI tool is an assistant, coding agent or local model runner that Metorial Desktop can find on enrolled devices. Each tool is sanctioned, not sanctioned or unreviewed per instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiToolsEndpoint {
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
   * @name List AI tools
   * @description Returns every AI tool in the detection catalog with its approval status and how many devices and people have it, most widely found first. The list is not paginated.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiToolsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiToolsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiToolsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiToolsListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-tools`;

    let request = {
      path,

      query: query ? mapDashboardInstanceAiToolsListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAiToolsListOutput);
  }

  /**
   * @name Get AI tool
   * @description Retrieves an AI tool with its approval status and usage in the instance.
   *
   * @param `instanceId` - string
   * @param `toolKey` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiToolsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    toolKey: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiToolsGetOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-tools/${encodeURIComponent(toolKey)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceAiToolsGetOutput);
  }
}
