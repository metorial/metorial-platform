import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardOrganizationsConfigureAuditLogRetentionGetOutput,
  mapDashboardOrganizationsConfigureAuditLogRetentionUpdateBody,
  mapDashboardOrganizationsConfigureAuditLogRetentionUpdateOutput,
  type DashboardOrganizationsConfigureAuditLogRetentionGetOutput,
  type DashboardOrganizationsConfigureAuditLogRetentionUpdateBody,
  type DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput
} from '../resources';

/**
 * @name Organization audit log retention controller
 * @description Configure organization audit log retention
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardOrganizationsConfigureAuditLogRetentionEndpoint {
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
   * @name Get audit log retention configuration
   * @description Get the audit log retention period for an organization
   *
   * @param `organizationId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConfigureAuditLogRetentionGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    organizationId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigureAuditLogRetentionGetOutput> {
    let path = `dashboard/organizations/${organizationId}/configure/audit-log-retention`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardOrganizationsConfigureAuditLogRetentionGetOutput
    );
  }

  /**
   * @name Update audit log retention configuration
   * @description Update the audit log retention period for an organization
   *
   * @param `organizationId` - string
   * @param `body` - DashboardOrganizationsConfigureAuditLogRetentionUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    organizationId: string,
    body: DashboardOrganizationsConfigureAuditLogRetentionUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/configure/audit-log-retention`;

    let request = {
      path,
      body: mapDashboardOrganizationsConfigureAuditLogRetentionUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsConfigureAuditLogRetentionUpdateOutput
    );
  }
}
