import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerDevicesTelemetryTokenIssueOutput,
  type ConsumerDevicesTelemetryTokenIssueOutput
} from '../resources';

/**
 * @name Consumer Devices controller
 * @description Enroll Metorial Desktop devices and choose which integrations and skills each AI tool on them receives.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerDevicesTelemetryTokenEndpoint {
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
   * @name Issue device telemetry token
   * @description Issues the ingest token the device sends agent telemetry with, bound to the consumer that enrolled this device. Every call rotates: the new token replaces the previous tokens of the device, which are revoked. The secret is only returned here. Returns 404 when agent telemetry is not collected for this organization, and 412 when the device is no longer signed in.
   *
   * @param `consumerDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesTelemetryTokenIssueOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  issue(
    consumerDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerDevicesTelemetryTokenIssueOutput> {
    let path = `consumer/devices/${consumerDeviceId}/telemetry-token`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapConsumerDevicesTelemetryTokenIssueOutput
    );
  }
}
