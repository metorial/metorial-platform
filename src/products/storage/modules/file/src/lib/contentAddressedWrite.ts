import { hashBytes, type ContentHashes } from '@lowerdeck/hash/content';
import { isInTransaction } from '@metorial/db';
import { cargoObjectDelete } from '../queues/objectDelete';
import { getCargoFilesBucketName } from '../storage';
import { ensureCargoObject, getContentAddressedKey, putCargoObject } from './cargoObjects';

let rolledBackObjectCleanupDelayMs = 10 * 60 * 1000;

// The caller's transaction can still roll back the File row and orphan the object. The delete
// is guarded, so it only removes the object if no File references it by then.
export let scheduleRolledBackObjectCleanup = async (storeId: string) => {
  if (!isInTransaction()) return;

  await cargoObjectDelete.queue
    .add(
      { bucket: getCargoFilesBucketName(), keys: [storeId] },
      { delay: rolledBackObjectCleanupDelayMs }
    )
    .catch(() => {});
};

// `create` must write the File row through fileService.createFile, which takes the object's
// advisory lock before the row. Once the lock is held no delete can run until the row commits, so
// a delete that slipped in between the PUT and the lock is caught by the check afterwards.
export let writeContentAddressedFile = async <T>(d: {
  content: Uint8Array;
  buffered: boolean;
  create: (target: { storeId: string; hashes: ContentHashes }) => Promise<T>;
}) => {
  let hashes = hashBytes(d.content);
  let storeId = getContentAddressedKey(hashes.sha256);

  if (d.buffered) return await d.create({ storeId, hashes });

  await putCargoObject({ key: storeId, content: d.content });

  let result: T;
  try {
    result = await d.create({ storeId, hashes });
  } catch (error) {
    await cargoObjectDelete.enqueue(getCargoFilesBucketName(), [storeId]).catch(() => {});
    throw error;
  }

  await ensureCargoObject({ key: storeId, content: d.content });
  await scheduleRolledBackObjectCleanup(storeId);

  return result;
};
