import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayVirtualModelTemplatesListOutput,
  type DashboardInstanceAiGatewayVirtualModelTemplatesListOutput
} from '../resources';

/**
 * @name AI gateway virtual model templates controller
 * @description Ready-made virtual model definitions for common routing setups. Pick the models they ask for to create a virtual model from one.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiGatewayVirtualModelTemplatesEndpoint {
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
   * @name List AI gateway virtual model templates
   * @description Returns every template. The list is not paginated.
   *
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayVirtualModelTemplatesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayVirtualModelTemplatesListOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/ai-gateway/virtual-model-templates`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayVirtualModelTemplatesListOutput
    );
  }
}
