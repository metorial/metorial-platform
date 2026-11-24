import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayVirtualModelsVersionsGetOutput,
  mapDashboardInstanceAiGatewayVirtualModelsVersionsListOutput,
  mapDashboardInstanceAiGatewayVirtualModelsVersionsListQuery,
  type DashboardInstanceAiGatewayVirtualModelsVersionsGetOutput,
  type DashboardInstanceAiGatewayVirtualModelsVersionsListOutput,
  type DashboardInstanceAiGatewayVirtualModelsVersionsListQuery
} from '../resources';

/**
 * @name AI gateway virtual model versions controller
 * @description Every change to the definition of a virtual model is kept as a numbered version that can be rolled back to.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiGatewayVirtualModelsVersionsEndpoint {
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
   * @name List AI gateway virtual model versions
   * @description Returns a paginated list of the versions of a virtual model.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `query` - DashboardInstanceAiGatewayVirtualModelsVersionsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsVersionsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    virtualModelId: string,
    query?: DashboardInstanceAiGatewayVirtualModelsVersionsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsVersionsListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}/versions`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayVirtualModelsVersionsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsVersionsListOutput
    );
  }

  /**
   * @name Get AI gateway virtual model version
   * @description Retrieves a version of a virtual model by ID, with its definition.
   *
   * @param `instanceId` - string
   * @param `virtualModelId` - string
   * @param `versionId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelsVersionsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    virtualModelId: string,
    versionId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelsVersionsGetOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-models/${encodeURIComponent(virtualModelId)}/versions/${encodeURIComponent(versionId)}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelsVersionsGetOutput
    );
  }
}
