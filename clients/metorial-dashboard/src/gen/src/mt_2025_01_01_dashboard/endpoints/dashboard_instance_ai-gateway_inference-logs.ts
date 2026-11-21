import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayInferenceLogsGetOutput,
  mapDashboardInstanceAiGatewayInferenceLogsGetQuery,
  mapDashboardInstanceAiGatewayInferenceLogsListOutput,
  mapDashboardInstanceAiGatewayInferenceLogsListQuery,
  type DashboardInstanceAiGatewayInferenceLogsGetOutput,
  type DashboardInstanceAiGatewayInferenceLogsGetQuery,
  type DashboardInstanceAiGatewayInferenceLogsListOutput,
  type DashboardInstanceAiGatewayInferenceLogsListQuery
} from '../resources';

/**
 * @name AI gateway inference logs controller
 * @description A record of every request made through the AI gateway: the model and provider used, tokens, cost, timing and errors. Kept for the configured log retention.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiGatewayInferenceLogsEndpoint {
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
   * @name List AI gateway inference logs
   * @description Returns inference logs, newest first, without request and response content. Pages only go towards older logs: pass the after cursor of the previous page. before cursors are rejected.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiGatewayInferenceLogsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayInferenceLogsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiGatewayInferenceLogsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayInferenceLogsListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/inference-logs`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayInferenceLogsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayInferenceLogsListOutput
    );
  }

  /**
   * @name Get AI gateway inference log
   * @description Retrieves an inference log by ID. Request and response content is only returned when include_content is set.
   *
   * @param `instanceId` - string
   * @param `inferenceLogId` - string
   * @param `query` - DashboardInstanceAiGatewayInferenceLogsGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayInferenceLogsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    inferenceLogId: string,
    query?: DashboardInstanceAiGatewayInferenceLogsGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayInferenceLogsGetOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/inference-logs/${encodeURIComponent(inferenceLogId)}`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayInferenceLogsGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayInferenceLogsGetOutput
    );
  }
}
