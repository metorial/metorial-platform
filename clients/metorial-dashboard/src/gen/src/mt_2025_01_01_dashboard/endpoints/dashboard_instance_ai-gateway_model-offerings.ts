import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayModelOfferingsListOutput,
  mapDashboardInstanceAiGatewayModelOfferingsListQuery,
  type DashboardInstanceAiGatewayModelOfferingsListOutput,
  type DashboardInstanceAiGatewayModelOfferingsListQuery
} from '../resources';

/**
 * @name AI gateway model offerings controller
 * @description How each provider serves a model: its id for the model, pricing, limits and capabilities.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiGatewayModelOfferingsEndpoint {
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
   * @name List AI gateway model offerings
   * @description Returns a paginated list of the offerings in the catalog that are not retired.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceAiGatewayModelOfferingsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayModelOfferingsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceAiGatewayModelOfferingsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayModelOfferingsListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/model-offerings`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayModelOfferingsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayModelOfferingsListOutput
    );
  }
}
