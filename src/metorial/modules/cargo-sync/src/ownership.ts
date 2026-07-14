import { db, ID } from '@metorial/db';
import { CARGO_SYNC_CLAIM_METORIAL_OWNERSHIP } from './flags';

export let isCargoSyncRecordOwned = async (model: string, recordId: string) =>
  Boolean(
    await db.cargoSyncMetorialOwnedRecord.findUnique({
      where: { model_recordId: { model, recordId } },
      select: { oid: true }
    })
  );

export let claimCargoSyncRecordOwnership = async (model: string, recordId: string) => {
  if (!CARGO_SYNC_CLAIM_METORIAL_OWNERSHIP) return;

  await db.cargoSyncMetorialOwnedRecord.upsert({
    where: { model_recordId: { model, recordId } },
    create: {
      id: await ID.generateId('cargoSyncMetorialOwnedRecord'),
      model,
      recordId
    },
    update: {}
  });
};
