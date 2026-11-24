import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayLabsListOutput,
  mapDashboardInstanceAiGatewayLabsListQuery,
  type DashboardInstanceAiGatewayLabsListOutput,
  type DashboardInstanceAiGatewayLabsListQuery
} from '../resources';

/**
 * @name AI gateway labs controller
 * @description The labs that make the models in the AI gateway catalog, e.g. Anthropic or OpenAI.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialAiGatewayLabsEndpoint {
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
   * @name List AI gateway labs
   * @description Returns a paginated list of the labs in the catalog.
   *
   * @param `query` - DashboardInstanceAiGatewayLabsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayLabsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceAiGatewayLabsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayLabsListOutput> {
    let path = 'ai-gateway/labs';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceAiGatewayLabsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayLabsListOutput
    );
  }
}
