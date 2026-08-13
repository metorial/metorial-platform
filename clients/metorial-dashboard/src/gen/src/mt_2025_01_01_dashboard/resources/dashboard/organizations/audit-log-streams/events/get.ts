import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsAuditLogStreamsEventsGetOutput = {
  object: 'organization.audit_log_stream.event';
  id: string;
  auditLogStreamId: string;
  type:
    | 'created'
    | 'started'
    | 'error'
    | 'error_paused'
    | 'recovered'
    | 'disabled';
  message: string | null;
  createdAt: Date;
};

export let mapDashboardOrganizationsAuditLogStreamsEventsGetOutput =
  mtMap.object<DashboardOrganizationsAuditLogStreamsEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    auditLogStreamId: mtMap.objectField(
      'audit_log_stream_id',
      mtMap.passthrough()
    ),
    type: mtMap.objectField('type', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

