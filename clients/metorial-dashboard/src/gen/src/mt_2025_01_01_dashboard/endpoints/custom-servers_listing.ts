import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceCustomServersListingGetOutput,
  mapDashboardInstanceCustomServersListingUpdateBody,
  mapDashboardInstanceCustomServersListingUpdateOutput,
  type DashboardInstanceCustomServersListingGetOutput,
  type DashboardInstanceCustomServersListingUpdateBody,
  type DashboardInstanceCustomServersListingUpdateOutput
} from '../resources';

/**
 * @name Custom Server controller
 * @description Manager custom servers
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialCustomServersListingEndpoint {
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
   * @name Get custom server listing
   * @description Get a custom server listing
   *
   * @param `customServerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersListingGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    customServerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersListingGetOutput> {
    let path = `custom-servers/${customServerId}/listing`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceCustomServersListingGetOutput
    );
  }

  /**
   * @name Update custom server listing
   * @description Update a custom server listing
   *
   * @param `customServerId` - string
   * @param `body` - DashboardInstanceCustomServersListingUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceCustomServersListingUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    customServerId: string,
    body: DashboardInstanceCustomServersListingUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceCustomServersListingUpdateOutput> {
    let path = `custom-servers/${customServerId}/listing`;

    let request = {
      path,
      body: mapDashboardInstanceCustomServersListingUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceCustomServersListingUpdateOutput
    );
  }
}
