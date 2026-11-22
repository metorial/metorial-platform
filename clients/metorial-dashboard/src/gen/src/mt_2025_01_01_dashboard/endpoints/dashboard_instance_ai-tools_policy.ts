import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceAiToolsPolicyUpdateBody,
  mapDashboardInstanceAiToolsPolicyUpdateOutput,
  type DashboardInstanceAiToolsPolicyUpdateBody,
  type DashboardInstanceAiToolsPolicyUpdateOutput
} from '../resources';

/**
 * @name AI Tools controller
 * @description An AI tool is an assistant, coding agent or local model runner that Metorial Desktop can find on enrolled devices. Each tool is sanctioned, not sanctioned or unreviewed per instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceAiToolsPolicyEndpoint {
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
   * @name Update AI tool policy
   * @description Sanctions an AI tool for the instance, or marks it not sanctioned or unreviewed. Omitted fields keep their current value. Devices are not changed; the status only labels what they report.
   *
   * @param `instanceId` - string
   * @param `toolKey` - string
   * @param `body` - DashboardInstanceAiToolsPolicyUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceAiToolsPolicyUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    toolKey: string,
    body: DashboardInstanceAiToolsPolicyUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceAiToolsPolicyUpdateOutput> {
    let path = `dashboard/instances/${instanceId}/ai-tools/${toolKey}/policy`;

    let request = {
      path,
      body: mapDashboardInstanceAiToolsPolicyUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceAiToolsPolicyUpdateOutput
    );
  }
}
