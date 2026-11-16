import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceConsumersDevicesGetOutput,
  mapDashboardInstanceConsumersDevicesListOutput,
  mapDashboardInstanceConsumersDevicesListQuery,
  mapDashboardInstanceConsumersDevicesRevokeOutput,
  type DashboardInstanceConsumersDevicesGetOutput,
  type DashboardInstanceConsumersDevicesListOutput,
  type DashboardInstanceConsumersDevicesListQuery,
  type DashboardInstanceConsumersDevicesRevokeOutput
} from '../resources';

/**
 * @name Consumer Devices controller
 * @description Inspect and revoke the Metorial Desktop devices consumers have enrolled.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceConsumersDevicesEndpoint {
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
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceConsumersDevicesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersDevicesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceConsumersDevicesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersDevicesListOutput> {
    let path = `instances/${instanceId}/consumer-devices`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceConsumersDevicesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumersDevicesListOutput
    );
  }

  /**
   * @name Get consumer device
   * @description Retrieves a Metorial Desktop device enrolled by a consumer.
   *
   * @param `instanceId` - string
   * @param `consumerDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersDevicesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    consumerDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersDevicesGetOutput> {
    let path = `instances/${instanceId}/consumer-devices/${consumerDeviceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceConsumersDevicesGetOutput
    );
  }

  /**
   * @name Revoke consumer device
   * @description Signs the device out and revokes its integration tokens. The app removes what it installed the next time it reaches Metorial.
   *
   * @param `instanceId` - string
   * @param `consumerDeviceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceConsumersDevicesRevokeOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  revoke(
    instanceId: string,
    consumerDeviceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceConsumersDevicesRevokeOutput> {
    let path = `instances/${instanceId}/consumer-devices/${consumerDeviceId}/revoke`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceConsumersDevicesRevokeOutput
    );
  }
}
