import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayRoutingPreviewBody,
  mapDashboardInstanceAiGatewayRoutingPreviewOutput,
  type DashboardInstanceAiGatewayRoutingPreviewBody,
  type DashboardInstanceAiGatewayRoutingPreviewOutput
} from '../resources';

/**
 * @name AI gateway routing controller
 * @description Shows how the AI gateway routes requests for a model on this instance, without sending one.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceAiGatewayRoutingEndpoint {
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
   * @name Preview AI gateway routing
   * @description Returns the providers a request for the model would be sent to, in the order they are tried, with their pricing. Tokens' allowed models are not applied.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceAiGatewayRoutingPreviewBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayRoutingPreviewOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  preview(
    instanceId: string,
    body: DashboardInstanceAiGatewayRoutingPreviewBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayRoutingPreviewOutput> {
    let path = `instances/${encodeURIComponent(instanceId)}/ai-gateway/routing/preview`;

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayRoutingPreviewBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceAiGatewayRoutingPreviewOutput
    );
  }
}
