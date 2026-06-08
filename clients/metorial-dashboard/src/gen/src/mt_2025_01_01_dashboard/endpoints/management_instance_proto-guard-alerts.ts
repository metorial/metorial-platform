import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProtoGuardAlertsGetOutput,
  mapDashboardInstanceProtoGuardAlertsListOutput,
  mapDashboardInstanceProtoGuardAlertsListQuery,
  type DashboardInstanceProtoGuardAlertsGetOutput,
  type DashboardInstanceProtoGuardAlertsListOutput,
  type DashboardInstanceProtoGuardAlertsListQuery
} from '../resources';

/**
 * @name ProtoGuard Alerts controller
 * @description ProtoGuard alerts describe prompt-injection detections.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProtoGuardAlertsEndpoint {
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
   * @name List ProtoGuard alerts
   * @description Returns a paginated list of ProtoGuard alerts for this instance.
   *
   * @param `instanceId` - string
   * @param `query` - DashboardInstanceProtoGuardAlertsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardAlertsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    query?: DashboardInstanceProtoGuardAlertsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardAlertsListOutput> {
    let path = `instances/${instanceId}/protoguard-alerts`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceProtoGuardAlertsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProtoGuardAlertsListOutput
    );
  }

  /**
   * @name Get ProtoGuard alert
   * @description Retrieves a ProtoGuard alert by ID.
   *
   * @param `instanceId` - string
   * @param `protoGuardAlertId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProtoGuardAlertsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    protoGuardAlertId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProtoGuardAlertsGetOutput> {
    let path = `instances/${instanceId}/protoguard-alerts/${protoGuardAlertId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceProtoGuardAlertsGetOutput
    );
  }
}
