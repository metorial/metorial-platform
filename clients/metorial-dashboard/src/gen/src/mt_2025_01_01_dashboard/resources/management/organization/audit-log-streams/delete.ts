import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationAuditLogStreamsDeleteOutput = {
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

export let mapManagementOrganizationAuditLogStreamsDeleteOutput =
  mtMap.object<ManagementOrganizationAuditLogStreamsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    provider: mtMap.objectField('provider', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    accessStatus: mtMap.objectField('access_status', mtMap.passthrough()),
    isPausedDueToError: mtMap.objectField(
      'is_paused_due_to_error',
      mtMap.passthrough()
    ),
    errorMessage: mtMap.objectField('error_message', mtMap.passthrough()),
    consecutiveErrorCount: mtMap.objectField(
      'consecutive_error_count',
      mtMap.passthrough()
    ),
    isStarted: mtMap.objectField('is_started', mtMap.passthrough()),
    providerData: mtMap.objectField('provider_data', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

