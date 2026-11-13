import { deleteInChunks } from '@lowerdeck/queue';
import { getStore } from '../store/connection';
import type { SliceErasureMode } from '../types';

let chunkSize = 500;
let maxChunks = 20;

// 07 §11: a user's slices are deleted, or kept for finance totals with the user removed from
// both the top-level id and the dims. `hasMore` asks the caller to run again (paced).
export let eraseUserFromSlices = async (d: {
  organizationId: string;
  userId: string;
  mode: SliceErasureMode;
}) => {
  let store = getStore();
  await store.ready();

  let slices = store.collections().usageSlices;
  let filter = {
    organizationId: d.organizationId,
    $or: [{ userId: d.userId }, { dimIds: d.userId }]
  };

  if (d.mode == 'delete') {
    let result = await deleteInChunks({
      chunkSize,
      maxChunks,
      selectKeys: async limit =>
        (
          await slices
            .find(filter, { projection: { _id: 1 } })
            .limit(limit)
            .toArray()
        ).map(slice => slice._id),
      deleteKeys: ids => slices.deleteMany({ ...filter, _id: { $in: ids } })
    });

    return { hasMore: result.hasMore };
  }

  await slices.updateMany(
    { organizationId: d.organizationId, userId: d.userId },
    { $unset: { userId: '' } }
  );
  await slices.updateMany(
    { organizationId: d.organizationId, dimIds: d.userId },
    { $pull: { dims: { id: d.userId }, dimIds: d.userId } }
  );

  return { hasMore: false };
};
