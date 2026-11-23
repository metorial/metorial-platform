import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { ID } from '@mtsrc/ai-gateway-db';
import {
  getStore,
  isStoreConfigured,
  type InferenceContentDocument,
  type InferenceLogDocument,
  type InferenceStatus
} from '@mtsrc/ai-gateway-store';
import { createBufferedWriter } from '../lib/bufferedWriter';
import {
  buildUsageTimeline,
  resolveUsageRange,
  usageBucketStages,
  type UsageInterval
} from '../lib/usage';

let dayMs = 24 * 60 * 60 * 1000;
let maxListLimit = 100;

type PendingLog = { log: InferenceLogDocument; content?: InferenceContentDocument };

let writer = createBufferedWriter<PendingLog>({
  flushIntervalMs: 1000,
  maxBatch: 500,
  maxBuffered: 20_000,
  write: async entries => {
    let store = getStore();
    await store.ready();

    let contents = entries.flatMap(entry => (entry.content ? [entry.content] : []));

    await Promise.all([
      store.inferenceLogs.insertMany(
        entries.map(entry => entry.log),
        { ordered: false }
      ),
      contents.length
        ? store.inferenceContents.insertMany(contents, { ordered: false })
        : undefined
    ]);
  },
  onDrop: (dropped, reason, error) =>
    console.error(`[ai-gateway] Dropped ${dropped} inference log(s): ${reason}`, error ?? '')
});

let assertStore = () => {
  if (!isStoreConfigured()) {
    throw new ServiceError(
      preconditionFailedError({ message: 'The inference log store is not configured.' })
    );
  }

  return getStore();
};

class InferenceLogServiceImpl {
  newLogId() {
    return ID.generateIdSync('inferenceLog');
  }

  record(d: {
    log: Omit<InferenceLogDocument, 'expiresAt' | 'hasContent'>;
    retentionDays: number;
    content?: { request: unknown; response?: unknown; retentionDays: number };
  }) {
    if (!isStoreConfigured()) return;

    let now = d.log.timing.completedAt;

    writer.push({
      log: {
        ...d.log,
        hasContent: !!d.content,
        expiresAt: new Date(now.getTime() + d.retentionDays * dayMs)
      },
      content: d.content && {
        _id: d.log._id,
        organizationId: d.log.organizationId,
        instanceId: d.log.instanceId,
        request: d.content.request,
        response: d.content.response,
        createdAt: now,
        expiresAt: new Date(now.getTime() + d.content.retentionDays * dayMs)
      }
    });
  }

  async flush() {
    await writer.flush();
  }

  async close() {
    await writer.close();
  }

  async listLogs(d: {
    organizationId: string;
    instanceId?: string;
    tokenId?: string;
    consumerRef?: string;
    modelSlug?: string;
    virtualModelId?: string;
    status?: InferenceStatus;
    before?: string;
    limit?: number;
  }) {
    let store = assertStore();
    await store.ready();

    let limit = Math.min(Math.max(d.limit ?? 50, 1), maxListLimit);

    let logs = await store.inferenceLogs
      .find({
        organizationId: d.organizationId,
        instanceId: d.instanceId,
        tokenId: d.tokenId,
        consumerRef: d.consumerRef,
        'model.slug': d.modelSlug,
        'virtualModel.id': d.virtualModelId,
        status: d.status,
        _id: d.before ? { $lt: d.before } : undefined
      })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean<InferenceLogDocument[]>();

    let hasMore = logs.length > limit;
    let items = logs.slice(0, limit);

    return { items, hasMore, nextCursor: hasMore ? items[items.length - 1]!._id : null };
  }

  async getLog(d: { organizationId: string; logId: string; includeContent?: boolean }) {
    let store = assertStore();
    await store.ready();

    let log = await store.inferenceLogs
      .findOne({ _id: d.logId, organizationId: d.organizationId })
      .lean<InferenceLogDocument>();
    if (!log) throw new ServiceError(notFoundError('inference_log'));

    let content =
      d.includeContent && log.hasContent
        ? await store.inferenceContents
            .findOne({ _id: d.logId, organizationId: d.organizationId })
            .lean<InferenceContentDocument>()
        : null;

    return { log, content };
  }

  async usageTimeline(d: {
    organizationId: string;
    instanceId: string;
    from: Date;
    to: Date;
    interval?: UsageInterval;
    tokenId?: string;
    consumerRef?: string;
    modelSlug?: string;
    virtualModelId?: string;
  }) {
    let range = resolveUsageRange(d);

    let store = assertStore();
    await store.ready();

    let filters = {
      tokenId: d.tokenId,
      consumerRef: d.consumerRef,
      'model.slug': d.modelSlug,
      'virtualModel.id': d.virtualModelId
    };

    // Unlike `find`, `aggregate` sends undefined filter values as null, which matches missing fields.
    let match = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined)
    );

    let rows = await store.inferenceLogs.aggregate([
      {
        $match: {
          ...match,
          organizationId: d.organizationId,
          instanceId: d.instanceId,
          'timing.receivedAt': { $gte: range.from, $lt: range.to }
        }
      },
      ...usageBucketStages(range.intervalMs)
    ]);

    return buildUsageTimeline(range, rows);
  }
}

export let inferenceLogService = Service.create(
  'inferenceLogService',
  () => new InferenceLogServiceImpl()
).build();
