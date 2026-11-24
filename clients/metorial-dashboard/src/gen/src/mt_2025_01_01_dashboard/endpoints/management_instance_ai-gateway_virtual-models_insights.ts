import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayVirtualModelsInsightsGetOutput,
  mapDashboardInstanceAiGatewayVirtualModelsInsightsGetQuery,
  type DashboardInstanceAiGatewayVirtualModelsInsightsGetOutput,
  type DashboardInstanceAiGatewayVirtualModelsInsightsGetQuery
} from '../resources';

/**
 * @name AI gateway virtual models controller
 * @description Virtual models are model names that pick a real model for every request, using rules, optional signals answered by a decision model, a default, and stickiness. Every change to the definition creates a new version.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceAiGatewayVirtualModelsInsightsEndpoint {
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
   * @name Get AI gateway virtual model insights
   * @description Summarizes how the virtual model routed requests over the last days: requests, failures, cost and latency per rule and model, decision model usage, and optionally the savings compared with sending everything to one model.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `query` - DashboardInstanceAiGatewayVirtualModelsInsightsGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsInsightsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    virtualModelId: string,
    query?: DashboardInstanceAiGatewayVirtualModelsInsightsGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsInsightsGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}/insights`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayVirtualModelsInsightsGetQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsInsightsGetOutput
    );
  }
}
