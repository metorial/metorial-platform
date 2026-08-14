import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsAuditLogStreamsEventsGetOutput,
  mapDashboardOrganizationsAuditLogStreamsEventsListOutput,
  mapDashboardOrganizationsAuditLogStreamsEventsListQuery,
  type DashboardOrganizationsAuditLogStreamsEventsGetOutput,
  type DashboardOrganizationsAuditLogStreamsEventsListOutput,
  type DashboardOrganizationsAuditLogStreamsEventsListQuery
} from '../resources';

/**
 * @name Audit log stream event controller
 * @description Read organization audit log stream lifecycle events
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsAuditLogStreamsEventsEndpoint {
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
   * @name List audit log stream events
   * @description List lifecycle events recorded for an audit log stream
   *
   * @param `organizationId` - string
   * @param `auditLogStreamId` - string
   * @param `query` - DashboardOrganizationsAuditLogStreamsEventsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsEventsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    auditLogStreamId: string,
    query?: DashboardOrganizationsAuditLogStreamsEventsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsEventsListOutput> {
    let path = `dashboard/organizations/${organizationId}/audit-log-streams/${auditLogStreamId}/events`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAuditLogStreamsEventsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAuditLogStreamsEventsListOutput
    );
  }

  /**
   * @name Get audit log stream event
   * @description Get a lifecycle event recorded for an audit log stream
   *
   * @param `organizationId` - string
   * @param `auditLogStreamId` - string
   * @param `auditLogStreamEventId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogStreamsEventsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    auditLogStreamId: string,
    auditLogStreamEventId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogStreamsEventsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/audit-log-streams/${auditLogStreamId}/events/${auditLogStreamEventId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAuditLogStreamsEventsGetOutput
    );
  }
}
