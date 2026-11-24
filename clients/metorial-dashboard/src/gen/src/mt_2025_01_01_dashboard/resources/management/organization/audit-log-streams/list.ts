import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAuditLogStreamsListOutput = {
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

export let mapManagementOrganizationAuditLogStreamsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationAuditLogStreamsListOutput>(
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

export type ManagementOrganizationAuditLogStreamsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAuditLogStreamsListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationAuditLogStreamsListQuery>(
    0
  );
