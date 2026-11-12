import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerDevicesClientsUpdateBody,
  mapConsumerDevicesClientsUpdateOutput,
  type ConsumerDevicesClientsUpdateBody,
  type ConsumerDevicesClientsUpdateOutput
} from '../resources';

/**
 * @name Consumer Devices controller
 * @description Enroll Metorial Desktop devices and choose which integrations and skills each AI tool on them receives.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerDevicesClientsEndpoint {
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
   * @name Update device AI tool
   * @description Turns an AI tool on the device on or off, and chooses which integrations and skills it does not receive. The device applies the change at its next sync.
   *
   * @param `consumerDeviceId` - string
   * @param `clientKey` - string
   * @param `body` - ConsumerDevicesClientsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesClientsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    consumerDeviceId: string,
    clientKey: string,
    body: ConsumerDevicesClientsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerDevicesClientsUpdateOutput> {
    let path = `consumer/devices/${consumerDeviceId}/clients/${clientKey}`;

    let request = {
      path,
      body: mapConsumerDevicesClientsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapConsumerDevicesClientsUpdateOutput
    );
  }
}
