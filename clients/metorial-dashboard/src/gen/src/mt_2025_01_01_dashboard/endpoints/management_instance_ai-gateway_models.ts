import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayModelsGetOutput,
  mapDashboardInstanceAiGatewayModelsListOutput,
  mapDashboardInstanceAiGatewayModelsListQuery,
  mapDashboardInstanceAiGatewayModelsResolveBody,
  mapDashboardInstanceAiGatewayModelsResolveOutput,
  type DashboardInstanceAiGatewayModelsGetOutput,
  type DashboardInstanceAiGatewayModelsListOutput,
  type DashboardInstanceAiGatewayModelsListQuery,
  type DashboardInstanceAiGatewayModelsResolveBody,
  type DashboardInstanceAiGatewayModelsResolveOutput
} from '../resources';

/**
 * @name AI gateway models controller
 * @description The models in the AI gateway catalog, with their capabilities and limits. The catalog is shared by all instances and kept up to date by Metorial.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceAiGatewayModelsEndpoint {
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
   * @name List AI gateway models
   * @description Returns a paginated list of the models in the catalog that are not retired.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiGatewayModelsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayModelsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiGatewayModelsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayModelsListOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/models`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayModelsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayModelsListOutput
    );
  }

  /**
   * @name Get AI gateway model
   * @description Retrieves a model by ID or slug. URL-encode the slash of a slug, e.g. anthropic%2Fclaude-sonnet-4.
   *
   * @param `instanceId` - string
   * @param `modelId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayModelsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    modelId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayModelsGetOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/models/${encodeURIComponent(modelId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayModelsGetOutput
    );
  }

  /**
   * @name Resolve AI gateway model
   * @description Finds the catalog model a model string refers to, the same way the gateway does for requests. Accepts slugs, names providers use for a model, and provider-pinned names like openai:gpt-4o.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAiGatewayModelsResolveBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayModelsResolveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  resolve(
    instanceId: string,
    body: DashboardInstanceAiGatewayModelsResolveBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayModelsResolveOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/models/resolve`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayModelsResolveBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayModelsResolveOutput
    );
  }
}
