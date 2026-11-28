import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

import {
  mapConsumerDevicesDetectionsReportBody,
  mapConsumerDevicesDetectionsReportOutput,
  type ConsumerDevicesDetectionsReportBody,
  type ConsumerDevicesDetectionsReportOutput
} from '../resources';

/**
 * @name Consumer Devices controller
 * @description Enroll Metorial Desktop devices and choose which integrations and skills each AI tool on them receives.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerDevicesDetectionsEndpoint {
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
   * @name Report device detections
   * @description Replaces what the device reported before with a full snapshot of the AI tools it found. Tools left out are marked gone. A report whose `seq` is not higher than the last accepted one changes nothing. Only the sign-in the device enrolled with can report; others get 412. Returns 403 `detection_disabled` when AI tool detection is off; the device then stops collecting.
   *
   * @param `consumerDeviceId` - string
   * @param `body` - ConsumerDevicesDetectionsReportBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesDetectionsReportOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  report(
    consumerDeviceId: string,
    body: ConsumerDevicesDetectionsReportBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerDevicesDetectionsReportOutput> {
    let path = `consumer/devices/${encodeURIComponent(consumerDeviceId)}/detections`;

    let request = {
      path,
      body: mapConsumerDevicesDetectionsReportBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerDevicesDetectionsReportOutput);
  }
}
