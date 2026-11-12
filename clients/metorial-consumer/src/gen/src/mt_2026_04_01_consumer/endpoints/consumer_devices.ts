import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapConsumerDevicesCheckInBody,
  mapConsumerDevicesCheckInOutput,
  mapConsumerDevicesGetOutput,
  mapConsumerDevicesListOutput,
  mapConsumerDevicesListQuery,
  mapConsumerDevicesRevokeOutput,
  mapConsumerDevicesSignOutOutput,
  type ConsumerDevicesCheckInBody,
  type ConsumerDevicesCheckInOutput,
  type ConsumerDevicesGetOutput,
  type ConsumerDevicesListOutput,
  type ConsumerDevicesListQuery,
  type ConsumerDevicesRevokeOutput,
  type ConsumerDevicesSignOutOutput
} from '../resources';

/**
 * @name Consumer Devices controller
 * @description Enroll Metorial Desktop devices and choose which integrations and skills each AI tool on them receives.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialConsumerDevicesEndpoint {
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
   * @name Check in device
   * @description Enrolls the signed-in Metorial Desktop device, or refreshes what it reports, and returns what each AI tool on it should receive.
   *
   * @param `body` - ConsumerDevicesCheckInBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesCheckInOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  checkIn(
    body: ConsumerDevicesCheckInBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerDevicesCheckInOutput> {
    let path = 'consumer/devices/check-in';

    let request = {
      path,
      body: mapConsumerDevicesCheckInBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerDevicesCheckInOutput);
  }

  /**
   * @name List devices
   * @description Returns the devices the authenticated consumer profile has enrolled.
   *
   * @param `query` - ConsumerDevicesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: ConsumerDevicesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerDevicesListOutput> {
    let path = 'consumer/devices';

    let request = {
      path,

      query: query ? mapConsumerDevicesListQuery.transformTo(query) : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerDevicesListOutput);
  }

  /**
   * @name Get device
   * @description Retrieves a device enrolled by the authenticated consumer profile.
   *
   * @param `consumerDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    consumerDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerDevicesGetOutput> {
    let path = `consumer/devices/${consumerDeviceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapConsumerDevicesGetOutput);
  }

  /**
   * @name Sign out device
   * @description Ends the device sign-in this request was made with and revokes its integration tokens. Other devices stay signed in.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesSignOutOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  signOut(opts?: {
    headers?: Record<string, string>;
  }): Promise<ConsumerDevicesSignOutOutput> {
    let path = 'consumer/devices/sign-out';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerDevicesSignOutOutput);
  }

  /**
   * @name Revoke device
   * @description Signs the device out and revokes its integration tokens. The app removes what it installed the next time it reaches Metorial.
   *
   * @param `consumerDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ConsumerDevicesRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    consumerDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ConsumerDevicesRevokeOutput> {
    let path = `consumer/devices/${consumerDeviceId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapConsumerDevicesRevokeOutput);
  }
}
