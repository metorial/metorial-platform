import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsAuditLogsGetOutput,
  mapDashboardOrganizationsAuditLogsListOutput,
  mapDashboardOrganizationsAuditLogsListQuery,
  type DashboardOrganizationsAuditLogsGetOutput,
  type DashboardOrganizationsAuditLogsListOutput,
  type DashboardOrganizationsAuditLogsListQuery
} from '../resources';

/**
 * @name Audit log controller
 * @description Read organization audit logs
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsAuditLogsEndpoint {
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
   * @name List organization audit logs
   * @description List audit logs recorded for the organization
   *
   * @param `organizationId` - string
   * @param `query` - DashboardOrganizationsAuditLogsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    organizationId: string,
    query?: DashboardOrganizationsAuditLogsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogsListOutput> {
    let path = `dashboard/organizations/${organizationId}/audit-logs`;

    let request = {
      path,

      query: query
        ? mapDashboardOrganizationsAuditLogsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAuditLogsListOutput
    );
  }

  /**
   * @name Get organization audit log
   * @description Get a specific audit log recorded for the organization
   *
   * @param `organizationId` - string
   * @param `auditLogId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsAuditLogsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    auditLogId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsAuditLogsGetOutput> {
    let path = `dashboard/organizations/${organizationId}/audit-logs/${auditLogId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsAuditLogsGetOutput
    );
  }
}
