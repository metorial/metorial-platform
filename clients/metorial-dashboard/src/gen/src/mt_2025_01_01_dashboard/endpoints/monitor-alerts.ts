import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceMonitorAlertsGetOutput,
  mapDashboardInstanceMonitorAlertsListOutput,
  mapDashboardInstanceMonitorAlertsListQuery,
  mapDashboardInstanceMonitorAlertsResolveOutput,
  mapDashboardInstanceMonitorAlertsUnresolveOutput,
  mapDashboardInstanceMonitorAlertsViewedOutput,
  type DashboardInstanceMonitorAlertsGetOutput,
  type DashboardInstanceMonitorAlertsListOutput,
  type DashboardInstanceMonitorAlertsListQuery,
  type DashboardInstanceMonitorAlertsResolveOutput,
  type DashboardInstanceMonitorAlertsUnresolveOutput,
  type DashboardInstanceMonitorAlertsViewedOutput
} from '../resources';

/**
 * @name Monitor Alerts controller
 * @description Monitor alerts represent detected prompt-injection or schema-change events.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialMonitorAlertsEndpoint {
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
   * @name List monitor alerts
   * @description Returns a paginated list of monitor alerts for this instance.
   *
   * @param `query` - DashboardInstanceMonitorAlertsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorAlertsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceMonitorAlertsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorAlertsListOutput> {
    let path = 'monitor-alerts';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceMonitorAlertsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMonitorAlertsListOutput
    );
  }

  /**
   * @name Get monitor alert
   * @description Retrieves a monitor alert by ID.
   *
   * @param `monitorAlertId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorAlertsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    monitorAlertId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorAlertsGetOutput> {
    let path = `monitor-alerts/${monitorAlertId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceMonitorAlertsGetOutput
    );
  }

  /**
   * @name Mark monitor alert viewed
   * @description Marks a monitor alert as viewed by the current actor.
   *
   * @param `monitorAlertId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorAlertsViewedOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  viewed(
    monitorAlertId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorAlertsViewedOutput> {
    let path = `monitor-alerts/${monitorAlertId}/viewed`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMonitorAlertsViewedOutput
    );
  }

  /**
   * @name Resolve monitor alert
   * @description Marks a monitor alert as resolved.
   *
   * @param `monitorAlertId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorAlertsResolveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  resolve(
    monitorAlertId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorAlertsResolveOutput> {
    let path = `monitor-alerts/${monitorAlertId}/resolve`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMonitorAlertsResolveOutput
    );
  }

  /**
   * @name Unresolve monitor alert
   * @description Reopens a resolved monitor alert.
   *
   * @param `monitorAlertId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceMonitorAlertsUnresolveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  unresolve(
    monitorAlertId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceMonitorAlertsUnresolveOutput> {
    let path = `monitor-alerts/${monitorAlertId}/unresolve`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceMonitorAlertsUnresolveOutput
    );
  }
}
