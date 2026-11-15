import { deleteInChunks } from '@lowerdeck/queue';
import { Service } from '@lowerdeck/service';
import type { SliceErasureMode } from '@mtsrc/agent-tracking-spec';
import { getStore } from '@mtsrc/agent-tracking-store';

let chunkSize = 500;
let maxChunks = 20;

class UsageErasureServiceImpl {
  // 07 §11: a user's slices are deleted, or kept for finance totals with the user removed from
  // both the top-level id and the dims. `hasMore` asks the caller to run again (paced).
  async eraseUser(d: { organizationId: string; userId: string; mode: SliceErasureMode }) {
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
  }

  async hasUserSlices(d: { organizationId: string; userId: string }) {
    let store = getStore();
    await store.ready();

    let slice = await store.collections().usageSlices.findOne(
      {
        organizationId: d.organizationId,
        $or: [{ userId: d.userId }, { dimIds: d.userId }]
      },
      { projection: { _id: 1 } }
    );

    return !!slice;
  }
}

export let usageErasureService = Service.create(
  'usageErasureService',
  () => new UsageErasureServiceImpl()
).build();
