import {
  Fabric,
  type AuditAgentTrackingIngestSource,
  type AuditAgentTrackingView,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let ingestSourcePayload = (ingestSource: AuditAgentTrackingIngestSource) => ({
  id: ingestSource.id,
  name: ingestSource.name,
  status: ingestSource.status,
  clientFamily: ingestSource.clientFamily,
  instanceId: ingestSource.instance.id,
  revokedAt: ingestSource.revokedAt
});

let viewPayload = (view: AuditAgentTrackingView) => ({
  id: view.id,
  name: view.name,
  status: view.status,
  page: view.page,
  kind: view.kind,
  params: view.params,
  instanceId: view.instance.id,
  creatorActorId: view.creatorActor?.id ?? null,
  deletedAt: view.deletedAt
});

export let recordAgentTrackingIngestTokenCreated = async (
  event: FabricEvents['agent_tracking.ingest_token.created:after']
) => {
  let { ingestToken } = event;
  let action = event.replacedIngestTokenIds.length ? ('rotate' as const) : ('create' as const);

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'agent_tracking_ingest_token',
      action,
      {
        payload: {
          id: ingestToken.id,
          serviceIngestTokenId: ingestToken.serviceIngestTokenId,
          name: ingestToken.name,
          status: ingestToken.status,
          deviceMode: ingestToken.deviceMode,
          consumerId: ingestToken.consumer.id,
          consumerDeviceId: ingestToken.consumerDevice?.id ?? null,
          replacedIngestTokenIds: event.replacedIngestTokenIds
        },
        recordedAt
      }
    );
  });
};

Fabric.listen(
  'agent_tracking.ingest_token.created:after',
  recordAgentTrackingIngestTokenCreated
);

export let recordAgentTrackingIngestSourceCreated = async (
  event: FabricEvents['agent_tracking.ingest_source.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'agent_tracking_ingest_source',
      'create',
      { payload: ingestSourcePayload(event.ingestSource), recordedAt }
    );
  });
};

export let recordAgentTrackingIngestSourceRevoked = async (
  event: FabricEvents['agent_tracking.ingest_source.revoked:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'agent_tracking_ingest_source',
      'revoke',
      {
        payload: ingestSourcePayload(event.ingestSource),
        previousPayload: ingestSourcePayload(event.previousIngestSource),
        recordedAt
      }
    );
  });
};

Fabric.listen(
  'agent_tracking.ingest_source.created:after',
  recordAgentTrackingIngestSourceCreated
);

Fabric.listen(
  'agent_tracking.ingest_source.revoked:after',
  recordAgentTrackingIngestSourceRevoked
);

export let recordAgentTrackingSettingsUpdated = async (
  event: FabricEvents['agent_tracking.settings.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'agent_tracking_settings',
      'update',
      {
        payload: event.settings,
        previousPayload: event.previousSettings,
        recordedAt
      }
    );
  });
};

Fabric.listen('agent_tracking.settings.updated:after', recordAgentTrackingSettingsUpdated);

export let recordAgentTrackingViewCreated = async (
  event: FabricEvents['agent_tracking.view.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'agent_tracking_view', 'create', {
      payload: viewPayload(event.view),
      recordedAt
    });
  });
};

export let recordAgentTrackingViewUpdated = async (
  event: FabricEvents['agent_tracking.view.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'agent_tracking_view', 'update', {
      payload: viewPayload(event.view),
      previousPayload: viewPayload(event.previousView),
      recordedAt
    });
  });
};

export let recordAgentTrackingViewDeleted = async (
  event: FabricEvents['agent_tracking.view.deleted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'agent_tracking_view', 'delete', {
      payload: viewPayload(event.view),
      previousPayload: viewPayload(event.previousView),
      recordedAt
    });
  });
};

Fabric.listen('agent_tracking.view.created:after', recordAgentTrackingViewCreated);

Fabric.listen('agent_tracking.view.updated:after', recordAgentTrackingViewUpdated);

Fabric.listen('agent_tracking.view.deleted:after', recordAgentTrackingViewDeleted);
