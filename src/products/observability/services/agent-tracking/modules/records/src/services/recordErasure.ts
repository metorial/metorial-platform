import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { deleteInChunks } from '@lowerdeck/queue';
import { Service } from '@lowerdeck/service';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import { getConfiguredSink } from '../lib/sink';
import { eraseRecordsQueue, planScopeErasure, type EraseScope } from '../queues/eraseRecords';

let chunkSize = 500;
let maxChunksPerCall = 20;

class RecordErasureServiceImpl {
  async eraseScope(d: { scope: EraseScope; instanceIds: string[] }) {
    let readback = getConfiguredSink().readback;

    if (!readback && !isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'No record store is configured.' })
      );
    }

    readback?.erase(d.scope);

    if (isStoreConfigured()) await eraseRecordsQueue.addMany(planScopeErasure(d));
  }

  // Stored content texts are keyed `<recordId>:<content index>`, so they go with their record.
  async eraseUser(d: { organizationId: string; userId: string }) {
    let store = getStore();
    await store.ready();

    let { events, measurements, contentTexts } = store.collections();
    let filter = { organizationId: d.organizationId, 'attribution.userId': d.userId };

    for (let records of [events, measurements]) {
      let result = await deleteInChunks({
        chunkSize,
        maxChunks: maxChunksPerCall,
        selectKeys: async limit =>
          await records
            .find(filter, { projection: { _id: 1, 'content.hasText': 1 } })
            .limit(limit)
            .toArray(),
        deleteKeys: async chunk => {
          let textIds = chunk.flatMap(record =>
            (record.content ?? []).flatMap((entry, index) =>
              entry.hasText ? [`${record._id}:${index}`] : []
            )
          );

          if (textIds.length) {
            await contentTexts.deleteMany({
              organizationId: d.organizationId,
              _id: { $in: textIds }
            });
          }

          await records.deleteMany({
            ...filter,
            _id: { $in: chunk.map(record => record._id) }
          });
        }
      });

      if (result.hasMore) return { hasMore: true };
    }

    return { hasMore: false };
  }

  async hasUserRecords(d: { organizationId: string; userId: string }) {
    let store = getStore();
    await store.ready();

    let { events, measurements } = store.collections();
    let filter = { organizationId: d.organizationId, 'attribution.userId': d.userId };

    for (let records of [events, measurements]) {
      if (await records.findOne(filter, { projection: { _id: 1 } })) return true;
    }

    return false;
  }
}

export let recordErasureService = Service.create(
  'recordErasureService',
  () => new RecordErasureServiceImpl()
).build();
