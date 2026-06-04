import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProtoGuardConfigGetOutput,
  mapDashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody,
  mapDashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput,
  mapDashboardInstanceProtoGuardConfigUpdateFilterBody,
  mapDashboardInstanceProtoGuardConfigUpdateFilterOutput,
  type DashboardInstanceProtoGuardConfigGetOutput,
  type DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody,
  type DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput,
  type DashboardInstanceProtoGuardConfigUpdateFilterBody,
  type DashboardInstanceProtoGuardConfigUpdateFilterOutput
} from '../resources';

/**
 * @name ProtoGuard Config controller
 * @description ProtoGuard config controls prompt-injection filters and alert thresholds.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialProtoGuardConfigEndpoint {
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
   * @name Get ProtoGuard config
   * @description Retrieves ProtoGuard filter configuration for this instance.
   *
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardConfigGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(opts?: {
    headers?: Record<string, string>;
  }): Promise<DashboardInstanceProtoGuardConfigGetOutput> {
    let path = 'protoguard-config';

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProtoGuardConfigGetOutput
    );
  }

  /**
   * @name Update ProtoGuard filter config
   * @description Updates ProtoGuard filter settings for this instance.
   *
   * @param `filterId` - string
   * @param `body` - DashboardInstanceProtoGuardConfigUpdateFilterBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardConfigUpdateFilterOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  updateFilter(
    filterId: string,
    body: DashboardInstanceProtoGuardConfigUpdateFilterBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardConfigUpdateFilterOutput> {
    let path = `protoguard-config/filters/${filterId}`;

    let request = {
      path,
      body: mapDashboardInstanceProtoGuardConfigUpdateFilterBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProtoGuardConfigUpdateFilterOutput
    );
  }

  /**
   * @name Set ProtoGuard alert filter count threshold
   * @description Sets or clears the number of matching ProtoGuard filters required to create an alert.
   *
   * @param `body` - DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  setAlertFilterCountThreshold(
    body: DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput> {
    let path = 'protoguard-config/alert-filter-count-threshold';

    let request = {
      path,
      body: mapDashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput
    );
  }
}
