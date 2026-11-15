import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordAgentTelemetryIngestTokenCreated = async (
  event: FabricEvents['agent_telemetry.ingest_token.created:after']
) => {
  let { ingestToken } = event;
  let action = event.replacedIngestTokenIds.length ? ('rotate' as const) : ('create' as const);

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'agent_telemetry_ingest_token',
      action,
      {
        payload: {
          id: ingestToken.id,
          groundstationIngestTokenId: ingestToken.groundstationIngestTokenId,
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
  'agent_telemetry.ingest_token.created:after',
  recordAgentTelemetryIngestTokenCreated
);
