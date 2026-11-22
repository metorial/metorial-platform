import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

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
 * @description Consumer device settings decide what Metorial Desktop monitors on the devices consumers enroll in an instance. AI tool detection is off until an admin accepts the privacy notice and turns it on.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerDeviceSettingsEndpoint {
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
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerDeviceSettingsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<DashboardInstanceConsumerDeviceSettingsGetOutput> {
    let path = 'consumer-device-settings';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumerDeviceSettingsGetOutput
    );
  }

  /**
   * @name Update consumer device settings
   * @description Updates the consumer device settings of the instance. Omitted fields keep their current value. Devices pick up the change at their next check-in.
   *
   * @param `body` - DashboardInstanceConsumerDeviceSettingsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerDeviceSettingsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    body: DashboardInstanceConsumerDeviceSettingsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerDeviceSettingsUpdateOutput> {
    let path = 'consumer-device-settings';

    let request = {
      path,
      body: mapDashboardInstanceConsumerDeviceSettingsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceConsumerDeviceSettingsUpdateOutput
    );
  }
}
