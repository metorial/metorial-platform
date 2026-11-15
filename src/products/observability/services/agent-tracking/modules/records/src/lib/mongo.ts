import { ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { createAdmission, type Admission } from '@mtsrc/agent-tracking-store';
import type { Store } from '@mtsrc/agent-tracking-store';
import type { ContentCipher } from '@mtsrc/agent-tracking-crypto';
import { toContentTextDocuments, toDocuments } from './mapper';
import type { ContentTextDocument } from '@mtsrc/agent-tracking-store';
import { writeDocuments, type WriteResult } from '@mtsrc/agent-tracking-store';
import { sinkBusyError, type RecordBatch, type RecordSink } from '@mtsrc/agent-tracking-store';

let textDocumentOverheadBytes = 256;
let maxReportedRejections = 20;

export type MongoWriteStats = {
  organizationId: string;
  instanceId: string;
  lane: RecordBatch['lane'];
  expired: number;
  events: WriteResult;
  measurements: WriteResult;
  contentTexts: WriteResult;
};

let textSize = (document: ContentTextDocument) =>
  document.ciphertext.length() + textDocumentOverheadBytes;

let reportRejections = (stats: MongoWriteStats) => {
  let rejections = [
    ...stats.events.rejections.map(item => ({ collection: 'events', ...item })),
    ...stats.measurements.rejections.map(item => ({ collection: 'measurements', ...item })),
    ...stats.contentTexts.rejections.map(item => ({ collection: 'content_texts', ...item }))
  ];

  if (!rejections.length) return;

  let listed = rejections.slice(0, maxReportedRejections);

  console.warn('Agent tracking store rejected documents', {
    organizationId: stats.organizationId,
    instanceId: stats.instanceId,
    count: rejections.length,
    rejections: listed
  });

  getSentry().captureMessage('Agent tracking store rejected documents', {
    level: 'warning',
    extra: {
      organizationId: stats.organizationId,
      instanceId: stats.instanceId,
      count: rejections.length,
      rejections: listed
    }
  });
};

export let createMongoSink = (d: {
  store: Store;
  cipher: ContentCipher;
  clock?: () => Date;
  admission?: Admission;
  onWrite?: (stats: MongoWriteStats) => void;
}): RecordSink => {
  let clock = d.clock ?? (() => new Date());
  let admission = d.admission ?? createAdmission();
  let onWrite = d.onWrite ?? reportRejections;

  d.store
    .ready()
    .catch(error => console.error('Agent tracking store is not reachable', error));

  return {
    write: async batch => {
      if (batch.records.length == 0) return;

      await admission.run(batch.lane, async () => {
        try {
          await d.store.ready();
        } catch (error) {
          console.warn('Agent tracking store is not reachable', error);
          throw new ServiceError(sinkBusyError());
        }

        let mapped = toDocuments(batch.records, { storage: batch.storage, now: clock() });

        let texts = toContentTextDocuments(mapped.texts, {
          organizationId: batch.organizationId,
          projectId: batch.projectId,
          instanceId: batch.instanceId,
          storage: batch.storage,
          cipher: d.cipher
        });

        // Texts go first so a stored record never points at text that is missing. Texts left
        // behind by a failed attempt are rewritten by the retry or expire through their TTL.
        let collections = d.store.collections();

        let contentTexts = await writeDocuments(collections.contentTexts, texts, textSize);

        let [events, measurements] = await Promise.all([
          writeDocuments(collections.events, mapped.events),
          writeDocuments(collections.measurements, mapped.measurements)
        ]);

        onWrite({
          organizationId: batch.organizationId,
          instanceId: batch.instanceId,
          lane: batch.lane,
          expired: mapped.expired,
          events,
          measurements,
          contentTexts
        });
      });
    },

    close: () => d.store.close()
  };
};
