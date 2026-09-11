import type { OutpostTokenKeyPair } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let outpostTokenKeyPairPayload = (keyPair: OutpostTokenKeyPair) => ({
  id: keyPair.id,
  status: keyPair.status,
  stopSigningAt: keyPair.stopSigningAt,
  stopVerifyingAt: keyPair.stopVerifyingAt
});

export let recordOutpostTokenKeyPairCreated = async (
  event: FabricEvents['outpost_token_key_pair.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'outpost_token_key_pair',
      'create',
      { payload: outpostTokenKeyPairPayload(event.keyPair), recordedAt }
    );
  });
};

export let recordOutpostTokenKeyPairReplaced = async (
  event: FabricEvents['outpost_token_key_pair.replaced:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'outpost_token_key_pair',
      'replace',
      {
        payload: outpostTokenKeyPairPayload(event.keyPair),
        previousPayload: outpostTokenKeyPairPayload(event.previousKeyPair),
        recordedAt
      }
    );
  });
};

export let recordOutpostTokenKeyPairExpired = async (
  event: FabricEvents['outpost_token_key_pair.expired:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'outpost_token_key_pair',
      'expire',
      {
        payload: outpostTokenKeyPairPayload(event.keyPair),
        previousPayload: outpostTokenKeyPairPayload(event.previousKeyPair),
        recordedAt
      }
    );
  });
};

Fabric.listen('outpost_token_key_pair.created:after', recordOutpostTokenKeyPairCreated);
Fabric.listen('outpost_token_key_pair.replaced:after', recordOutpostTokenKeyPairReplaced);
Fabric.listen('outpost_token_key_pair.expired:after', recordOutpostTokenKeyPairExpired);
