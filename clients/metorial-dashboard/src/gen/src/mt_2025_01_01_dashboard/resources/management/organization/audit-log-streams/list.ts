import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<ManagementOrganizationAuditLogStreamsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
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
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ManagementOrganizationAuditLogStreamsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationAuditLogStreamsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

