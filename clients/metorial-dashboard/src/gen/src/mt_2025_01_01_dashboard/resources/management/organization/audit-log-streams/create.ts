import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationAuditLogStreamsCreateOutput = {
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
};

export let mapManagementOrganizationAuditLogStreamsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationAuditLogStreamsCreateOutput>(
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
    ],
    1
  );

export type ManagementOrganizationAuditLogStreamsCreateBody = {
  provider: 'datadog' | 'splunk';
  providerData: Record<string, any>;
};

export let mapManagementOrganizationAuditLogStreamsCreateBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationAuditLogStreamsCreateBody>([
    'provider_data'
  ]);
