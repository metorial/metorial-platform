import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConsumerDevicesGetOutput,
  mapDashboardInstanceConsumerDevicesListOutput,
  mapDashboardInstanceConsumerDevicesListQuery,
  mapDashboardInstanceConsumerDevicesRevokeOutput,
  type DashboardInstanceConsumerDevicesGetOutput,
  type DashboardInstanceConsumerDevicesListOutput,
  type DashboardInstanceConsumerDevicesListQuery,
  type DashboardInstanceConsumerDevicesRevokeOutput
} from '../resources';

/**
 * @name Consumer Devices controller
 * @description Inspect and revoke the Metorial Desktop devices consumers have enrolled.
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
   * @name List consumer devices
   * @description Returns the Metorial Desktop devices enrolled by consumers of an instance.
   *
   * @param `query` - DashboardInstanceConsumerDevicesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerDevicesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceConsumerDevicesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerDevicesListOutput> {
    let path = 'consumer-devices';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceConsumerDevicesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumerDevicesListOutput
    );
  }

  /**
   * @name Get consumer device
   * @description Retrieves a Metorial Desktop device enrolled by a consumer.
   *
   * @param `consumerDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerDevicesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    consumerDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerDevicesGetOutput> {
    let path = `consumer-devices/${consumerDeviceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumerDevicesGetOutput
    );
  }

  /**
   * @name Revoke consumer device
   * @description Signs the device out and revokes its integration tokens. The app removes what it installed the next time it reaches Metorial.
   *
   * @param `consumerDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumerDevicesRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    consumerDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumerDevicesRevokeOutput> {
    let path = `consumer-devices/${consumerDeviceId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceConsumerDevicesRevokeOutput
    );
  }
}
