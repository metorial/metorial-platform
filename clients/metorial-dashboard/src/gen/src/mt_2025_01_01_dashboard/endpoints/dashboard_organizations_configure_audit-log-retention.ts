import { MetorialEndpointManager } from '@metorial/util-endpoint';
import {
  mapDashboardOrganizationsConfigureAuditLogRetentionGetOutput,
  mapDashboardOrganizationsConfigureAuditLogRetentionUpdateBody,
  mapDashboardOrganizationsConfigureAuditLogRetentionUpdateOutput,
  type DashboardOrganizationsConfigureAuditLogRetentionGetOutput,
  type DashboardOrganizationsConfigureAuditLogRetentionUpdateBody,
  type DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput
} from '../resources';

export class MetorialDashboardOrganizationsConfigureAuditLogRetentionEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  private _get(request: any) {
    return this._manager._get(request);
  }

  private _patch(request: any) {
    return this._manager._patch(request);
  }

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

  update(
    organizationId: string,
    body: DashboardOrganizationsConfigureAuditLogRetentionUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardOrganizationsConfigureAuditLogRetentionUpdateOutput> {
    let path = `dashboard/organizations/${organizationId}/configure/audit-log-retention`;
    let request = {
      path,
      body: mapDashboardOrganizationsConfigureAuditLogRetentionUpdateBody.transformTo(body),
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardOrganizationsConfigureAuditLogRetentionUpdateOutput
    );
  }
}
