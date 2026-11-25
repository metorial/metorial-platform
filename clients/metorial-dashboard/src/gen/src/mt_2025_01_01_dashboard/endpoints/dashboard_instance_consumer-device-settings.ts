import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConsumerDeviceSettingsGetOutput,
  mapDashboardInstanceConsumerDeviceSettingsUpdateBody,
  mapDashboardInstanceConsumerDeviceSettingsUpdateOutput,
  type DashboardInstanceConsumerDeviceSettingsGetOutput,
  type DashboardInstanceConsumerDeviceSettingsUpdateBody,
  type DashboardInstanceConsumerDeviceSettingsUpdateOutput
} from '../resources';

/**
 * @name Consumer Device Settings controller
 * @description Consumer device settings decide what Metorial Desktop monitors on enrolled devices in an instance and how it connects their AI tools. AI tool detection stays off until an admin accepts its privacy notice.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceConsumerDeviceSettingsEndpoint {
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
   * @name Get consumer device settings
   * @description Retrieves the consumer device settings of the instance.
   *
   * @param `instanceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerDeviceSettingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerDeviceSettingsGetOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/consumer-device-settings`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceConsumerDeviceSettingsGetOutput);
  }

  /**
   * @name Update consumer device settings
   * @description Updates the consumer device settings of the instance. Omitted fields keep their current value. Devices pick up the change at their next check-in. Setting `connection_mode` to `direct` requires a user signed in to the dashboard; API keys get 403.
   *
   * @param `instanceId` - string
   * @param `body` - DashboardInstanceConsumerDeviceSettingsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerDeviceSettingsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    instanceId: string,
    body: DashboardInstanceConsumerDeviceSettingsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerDeviceSettingsUpdateOutput> {
    let path = `dashboard/instances/${encodeURIComponent(instanceId)}/consumer-device-settings`;

    let request = {
      path,
      body: mapDashboardInstanceConsumerDeviceSettingsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceConsumerDeviceSettingsUpdateOutput
    );
  }
}
