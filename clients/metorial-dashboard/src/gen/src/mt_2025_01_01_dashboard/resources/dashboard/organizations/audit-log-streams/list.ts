import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsAuditLogStreamsListOutput = {
  items: {
    object: 'organization.audit_log_stream';
    id: string;
    organizationId: string;
    provider: 'datadog' | 'splunk';
    status: 'active' | 'inactive';
    accessStatus: 'ok' | 'error';
    isPausedDueToError: boolean;
    errorMessage: string | null;
    consecutiveErrorCount: number;
    isStarted: boolean;
    providerData: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsAuditLogStreamsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAuditLogStreamsListOutput>(
    [
      7,
      [
        1,
        [
          'organization_id',
          'access_status',
          'is_paused_due_to_error',
          'error_message',
          'consecutive_error_count',
          'is_started',
          'provider_data',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsAuditLogStreamsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsAuditLogStreamsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsAuditLogStreamsListQuery>(
    0
  );
