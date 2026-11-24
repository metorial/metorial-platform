import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiGatewayConfigGetOutput,
  mapDashboardInstanceAiGatewayConfigUpdateBody,
  mapDashboardInstanceAiGatewayConfigUpdateOutput,
  type DashboardInstanceAiGatewayConfigGetOutput,
  type DashboardInstanceAiGatewayConfigUpdateBody,
  type DashboardInstanceAiGatewayConfigUpdateOutput
} from '../resources';

/**
 * @name AI gateway configuration controller
 * @description Settings, limits and log retention for every request made through the AI gateway in this instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialAiGatewayConfigEndpoint {
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
   * @name Get AI gateway configuration
   * @description Retrieves the instance's AI gateway settings and limits, along with the limits and restrictions of your plan.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayConfigGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<DashboardInstanceAiGatewayConfigGetOutput> {
    let path = 'ai-gateway/config';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceAiGatewayConfigGetOutput
    );
  }

  /**
   * @name Update AI gateway configuration
   * @description Updates the log retention, settings or limits. Fields you omit keep their current value.
   *
   * @param `body` - DashboardInstanceAiGatewayConfigUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiGatewayConfigUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    body: DashboardInstanceAiGatewayConfigUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiGatewayConfigUpdateOutput> {
    let path = 'ai-gateway/config';

    let request = {
      path,
      body: mapDashboardInstanceAiGatewayConfigUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceAiGatewayConfigUpdateOutput
    );
  }
}
