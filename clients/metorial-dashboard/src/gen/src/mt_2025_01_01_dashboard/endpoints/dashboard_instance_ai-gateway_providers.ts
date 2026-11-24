import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayProvidersListOutput,
  mapDashboardInstanceAiGatewayProvidersListQuery,
  type DashboardInstanceAiGatewayProvidersListOutput,
  type DashboardInstanceAiGatewayProvidersListQuery
} from '../resources';

/**
 * @name AI gateway providers controller
 * @description The providers that serve models in the AI gateway catalog, e.g. OpenAI, Amazon Bedrock or OpenRouter.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiGatewayProvidersEndpoint {
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
   * @name List AI gateway providers
   * @description Returns a paginated list of the providers in the catalog, including whether you can connect your own account for each.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiGatewayProvidersListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayProvidersListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiGatewayProvidersListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayProvidersListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/providers`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayProvidersListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayProvidersListOutput
    );
  }
}
