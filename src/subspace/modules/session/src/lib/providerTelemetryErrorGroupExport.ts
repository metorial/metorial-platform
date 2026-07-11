import { createHash } from 'node:crypto';
import { getSentry } from '@lowerdeck/sentry';
import {
  getOffloadedSessionMessage,
  getProviderTelemetryErrorGroupsStorageTarget
} from '@metorial-subspace/connection-utils';
import { db, messageTranslator } from '@metorial-subspace/db';
import { JsonProcessor, OpenRedaction } from 'openredaction';
import { sessionMessageService } from '../services/sessionMessage';

export let PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY =
  'provider-telemetry/error-groups/failed-messages/state.json';

// Downstream ingestion only picks up `.json` keys; quarantine objects use
// `.jsonl` so they are ignored.
export let PROVIDER_TELEMETRY_QUARANTINE_KEY_PREFIX =
  'provider-telemetry/failed-messages/quarantine/';

let DEFAULT_EXPORT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
let EXPORT_PAGE_SIZE = 100;

// Must cover the grouping queue's ~4h retry horizon; quarantining earlier
// would drop errors that would still group.
export let PROVIDER_TELEMETRY_EXPORT_READINESS_GRACE_MS = 4 * 60 * 60 * 1000;

// Keeps the createdAt cursor behind in-flight writes so no row is missed.
export let PROVIDER_TELEMETRY_EXPORT_VISIBILITY_LAG_MS = 2 * 60 * 1000;

// A terminally failed job must be removed or it blocks later enqueues of the
// static job id.
export let PROVIDER_TELEMETRY_EXPORT_QUEUE_JOB_OPTIONS = {
  attempts: 3,
  removeOnFail: true
};

export type ProviderTelemetryFailedMessagesExportWatermark = {
  occurred_at: string;
  id: string;
};

export type ProviderTelemetryFailedMessagesExportRunSummary = {
  status: 'running' | 'completed' | 'deferred';
  exported_count: number;
  quarantined_count: number;
  deferred_count: number;
};

export type ProviderTelemetryFailedMessagesExportState = {
  version: 2;
  last_exported: ProviderTelemetryFailedMessagesExportWatermark | null;
  last_checked_at: string;
  last_processed?: ProviderTelemetryFailedMessagesExportWatermark | null;
  last_run?: ProviderTelemetryFailedMessagesExportRunSummary | null;
};

export type ProviderTelemetryErrorGroupsExportState =
  ProviderTelemetryFailedMessagesExportState;

type ProviderTelemetryErrorGroupsExportStorage = {
  upsertBucket(bucket: string): Promise<unknown>;
  getObject(bucket: string, key: string): Promise<{ data: Buffer | Uint8Array | string }>;
  putObject(
    bucket: string,
    key: string,
    data: Buffer | Uint8Array | Blob | ReadableStream | string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<unknown>;
};

export type ProviderTelemetryFailedMessageExportCandidate = {
  error: any;
  message: any;
  occurredAt: Date;
  provider: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tool: {
    id: string;
    key: string;
    name: string | null;
  } | null;
};

export type ProviderTelemetryFailedMessagesExportPageError = {
  error: any;
  occurredAt: Date;
  isReady: boolean;
  candidates: ProviderTelemetryFailedMessageExportCandidate[];
};

export type ProviderTelemetryFailedMessagesExportList = {
  errors: ProviderTelemetryFailedMessagesExportPageError[];
  hasMore: boolean;
};

export type ProviderTelemetryFailedMessagesExportListInput = {
  range: { from: Date; to: Date };
  limit?: number;
  after?: ProviderTelemetryFailedMessagesExportWatermark | null;
};

export type ProviderTelemetryFailedMessageQuarantineRecord = {
  object: 'provider_telemetry.failed_message_export_quarantine';
  version: 1;
  stage: 'readiness' | 'present' | 'redact';
  reason: string;
  error_id: string;
  message_id: string | null;
  message_ids?: string[];
  occurred_at: string;
  fingerprint: string;
  quarantined_at: string;
};

export class ProviderTelemetryExportInfraError extends Error {
  causedBy?: unknown;

  constructor(message: string, causedBy?: unknown) {
    super(message);
    this.name = 'ProviderTelemetryExportInfraError';
    this.causedBy = causedBy;
  }
}

class ProviderTelemetryExportItemError extends Error {
  stage: 'present' | 'redact';
  causedBy: unknown;

  constructor(stage: 'present' | 'redact', causedBy: unknown) {
    super(`Provider telemetry export item preparation failed during ${stage}`);
    this.name = 'ProviderTelemetryExportItemError';
    this.stage = stage;
    this.causedBy = causedBy;
  }
}

let objectDataToString = (data: Buffer | Uint8Array | string) =>
  typeof data === 'string' ? data : Buffer.from(data).toString('utf8');

let isNotFoundError = (error: unknown) =>
  !!error &&
  typeof error === 'object' &&
  'statusCode' in error &&
  (error as { statusCode?: number }).statusCode === 404;

let readProviderTelemetryErrorGroupsExportState = async (d: {
  storage: ProviderTelemetryErrorGroupsExportStorage;
  bucketName: string;
}) => {
  try {
    let object = await d.storage.getObject(
      d.bucketName,
      PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY
    );
    let state = JSON.parse(
      objectDataToString(object.data)
    ) as ProviderTelemetryFailedMessagesExportState;

    return state.version === 2 ? state : null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
};

let getExportRange = (
  state: ProviderTelemetryFailedMessagesExportState | null | undefined,
  now: Date
) => {
  // Never use `last_checked_at` here: it advances on empty runs and would
  // skip errors that become ready afterwards.
  let watermark = state?.last_processed ?? state?.last_exported ?? null;
  let from = watermark
    ? new Date(watermark.occurred_at)
    : new Date(now.getTime() - DEFAULT_EXPORT_LOOKBACK_MS);

  return {
    from,
    to: new Date(now.getTime() - PROVIDER_TELEMETRY_EXPORT_VISIBILITY_LAG_MS)
  };
};

let watermarkFor = (
  errorId: string,
  occurredAt: Date
): ProviderTelemetryFailedMessagesExportWatermark => ({
  occurred_at: occurredAt.toISOString(),
  id: errorId
});

let providerFromCandidate = (error: any, message: any) => {
  let provider =
    error.providerRun?.provider ??
    message.providerRun?.provider ??
    message.toolCall?.tool?.provider ??
    null;

  if (!provider) return null;

  return {
    id: provider.id,
    name: provider.name,
    slug: provider.listing?.slug ?? provider.slug ?? provider.globalIdentifier ?? provider.id
  };
};

let toolFromMessage = (message: any) => {
  if (!message.toolCall) return null;

  return {
    id: message.toolCall.id,
    key: message.toolCall.toolKey,
    name: message.toolCall.tool?.name ?? null
  };
};

export let listProviderTelemetryFailedMessagesForExport = async (
  input: ProviderTelemetryFailedMessagesExportListInput
): Promise<ProviderTelemetryFailedMessagesExportList> => {
  let limit = Math.max(1, Math.min(input.limit ?? EXPORT_PAGE_SIZE, EXPORT_PAGE_SIZE));
  let afterDate = input.after ? new Date(input.after.occurred_at) : null;

  let errors = await db.sessionError.findMany({
    where: {
      AND: [
        // Ungrouped errors are included so the cursor cannot advance past an
        // error that is not ready yet.
        { createdAt: { gte: input.range.from, lte: input.range.to } },
        { sessionMessages: { some: { status: 'failed' as const } } },
        input.after && afterDate
          ? {
              OR: [
                { createdAt: { gt: afterDate } },
                { createdAt: afterDate, id: { gt: input.after.id } }
              ]
            }
          : undefined!
      ].filter(Boolean)
    },
    include: {
      group: true,
      providerRun: {
        include: {
          provider: {
            include: {
              listing: true
            }
          }
        }
      },
      sessionMessages: {
        where: {
          status: 'failed'
        },
        include: {
          session: true,
          sessionProvider: true,
          connection: true,
          providerRun: {
            include: {
              provider: {
                include: {
                  listing: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1
  });

  let pageErrors = errors.slice(0, limit);
  let isReady = (error: any) => error.groupOid != null || !!error.group;

  let readyMessages = pageErrors.filter(isReady).flatMap(error => error.sessionMessages);
  let enrichedMessages = await sessionMessageService.enrichMessages(readyMessages as any);
  let enrichedMessageMap = new Map(enrichedMessages.map(message => [message.oid, message]));

  let pageEntries = pageErrors.map(error => {
    let ready = isReady(error);

    return {
      error,
      occurredAt: error.createdAt,
      isReady: ready,
      candidates: error.sessionMessages.map(rawMessage => {
        let message = ready
          ? (enrichedMessageMap.get(rawMessage.oid) ?? rawMessage)
          : rawMessage;

        return {
          error,
          message,
          occurredAt: error.createdAt,
          provider: providerFromCandidate(error, message),
          tool: toolFromMessage(message)
        };
      })
    };
  });

  return {
    errors: pageEntries,
    hasMore: errors.length > limit
  };
};

export type ProviderTelemetryErrorGroupsExportDeps = {
  now?: Date;
  bucketName?: string;
  storage?: ProviderTelemetryErrorGroupsExportStorage;
  listFailedMessages?: (
    input: ProviderTelemetryFailedMessagesExportListInput
  ) => Promise<ProviderTelemetryFailedMessagesExportList>;
  presentMessage?: (message: any) => Promise<unknown>;
};

let writeJsonObject = async (d: {
  storage: ProviderTelemetryErrorGroupsExportStorage;
  bucketName: string;
  key: string;
  value: unknown;
  metadata?: Record<string, string>;
}) => {
  await d.storage.putObject(
    d.bucketName,
    d.key,
    JSON.stringify(d.value, null, 2),
    'application/json',
    d.metadata
  );
};

let objectExists = async (d: {
  storage: ProviderTelemetryErrorGroupsExportStorage;
  bucketName: string;
  key: string;
}) => {
  try {
    await d.storage.getObject(d.bucketName, d.key);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
};

let providerTelemetryExportRedactor = new OpenRedaction({
  deterministic: true,
  redactionMode: 'placeholder' as const,
  enableLearning: false,
  enableCache: true
});
let providerTelemetryExportJsonProcessor = new JsonProcessor();

let normalizeJsonValue = (value: unknown) => {
  let json = JSON.stringify(value);
  return json === undefined ? undefined : JSON.parse(json);
};

let redactProviderTelemetryExportPayload = async (value: unknown) => {
  let normalized = normalizeJsonValue(value);
  if (normalized === undefined) return normalized;

  let detection = await providerTelemetryExportJsonProcessor.detect(
    normalized,
    providerTelemetryExportRedactor
  );

  return providerTelemetryExportJsonProcessor.redact(normalized, detection);
};

let normalizeS3KeyComponent = (value: string | null | undefined) => {
  let normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 120);

  return normalized || 'unknown';
};

let fingerprintOf = (parts: Array<string | null | undefined>) =>
  createHash('sha256')
    .update(parts.map(part => part ?? '').join('\n'))
    .digest('hex')
    .slice(0, 16);

export let getProviderTelemetryFailedMessagesExportChunkKey = (
  candidates: ProviderTelemetryFailedMessageExportCandidate[]
) => {
  let first = candidates[0];
  let last = candidates[candidates.length - 1];
  if (!first || !last) {
    throw new Error('Cannot create a provider telemetry export chunk key without items');
  }

  // The key encodes the member identity (count + id hash): identical sets map
  // to the same key, different sets never collide.
  let memberHash = createHash('sha256')
    .update(JSON.stringify(candidates.map(item => [item.error.id, item.message.id])))
    .digest('hex')
    .slice(0, 12);

  let filename = [
    'failed-messages',
    String(Math.floor(first.occurredAt.getTime() / 1000)),
    String(Math.floor(last.occurredAt.getTime() / 1000)),
    first.error.id,
    last.error.id,
    String(candidates.length),
    memberHash
  ]
    .map(normalizeS3KeyComponent)
    .join('-');

  return ['provider-telemetry', `${filename}.json`].join('/');
};

export let getProviderTelemetryFailedMessageQuarantineKey = (
  record: Pick<
    ProviderTelemetryFailedMessageQuarantineRecord,
    'occurred_at' | 'error_id' | 'message_id' | 'stage'
  >
) => {
  let filename = [
    String(Math.floor(new Date(record.occurred_at).getTime() / 1000)),
    record.error_id,
    record.message_id ?? 'error',
    record.stage
  ]
    .map(normalizeS3KeyComponent)
    .join('-');

  return `${PROVIDER_TELEMETRY_QUARANTINE_KEY_PREFIX}${filename}.jsonl`;
};

let createExportPayload = async (message: any) => {
  if (message.isOffloadedToStorage) {
    let offloaded = await getOffloadedSessionMessage(message);
    if (offloaded) {
      message.input = offloaded.input;
      message.output = offloaded.output;
    }
  }

  return {
    object: 'session.message',
    id: message.id,
    type: message.type,
    status: message.status,
    source: message.source,
    sessionId: message.session?.id ?? null,
    sessionProviderId: message.sessionProvider?.id ?? null,
    connectionId: message.connection?.id ?? null,
    providerRunId: message.providerRun?.id ?? null,
    input: message.input
      ? await messageTranslator.inputToMcpBasic(message.input, message)
      : null,
    output: message.output
      ? await messageTranslator.outputToMcpBasic(message.output, message)
      : null,
    toolCall: message.toolCall
      ? {
          id: message.toolCall.id,
          toolKey: message.toolCall.toolKey,
          rationale: message.toolCall.rationale,
          operation: message.toolCall.operation,
          tool: message.toolCall.tool
            ? {
                id: message.toolCall.tool.id,
                key: message.toolCall.tool.key,
                name: message.toolCall.tool.name,
                providerId: message.toolCall.tool.provider?.id ?? null
              }
            : null
        }
      : null,
    error: message.error
      ? {
          id: message.error.id,
          code: message.error.code,
          message: message.error.message,
          data: message.error.payload,
          groupId: message.error.group?.id ?? null
        }
      : null,
    createdAt: message.createdAt
  };
};

let createExportItem = async (d: {
  candidate: ProviderTelemetryFailedMessageExportCandidate;
  presentMessage: (message: any) => Promise<unknown>;
}) => {
  let payload: unknown;
  try {
    payload = await d.presentMessage(d.candidate.message);
  } catch (error) {
    if (error instanceof ProviderTelemetryExportInfraError) throw error;
    throw new ProviderTelemetryExportItemError('present', error);
  }

  let redactedPayload: unknown;
  try {
    redactedPayload = await redactProviderTelemetryExportPayload(payload);
  } catch (error) {
    throw new ProviderTelemetryExportItemError('redact', error);
  }

  return {
    occurred_at: d.candidate.occurredAt.toISOString(),
    error_group_id: d.candidate.error.group?.id ?? null,
    error_id: d.candidate.error.id,
    message_id: d.candidate.message.id,
    provider: d.candidate.provider,
    tool: d.candidate.tool,
    payload: redactedPayload
  };
};

let createExportChunk = (d: {
  items: unknown[];
  range: { from: Date; to: Date };
  now: Date;
}) => ({
  object: 'admin.provider_error_group.failed_message_export_chunk',
  version: 1,
  generated_at: d.now.toISOString(),
  range: {
    from: d.range.from.toISOString(),
    to: d.range.to.toISOString()
  },
  item_count: d.items.length,
  items: d.items
});

let captureQuarantineDiagnostics = (
  record: ProviderTelemetryFailedMessageQuarantineRecord,
  objectKey: string
) => {
  try {
    getSentry().captureMessage('Provider telemetry export quarantined a record', {
      level: 'warning' as const,
      extra: {
        stage: record.stage,
        reason: record.reason,
        errorId: record.error_id,
        messageId: record.message_id,
        messageIds: record.message_ids,
        occurredAt: record.occurred_at,
        fingerprint: record.fingerprint,
        objectKey
      }
    });
  } catch {
    // Diagnostics must never fail the export run.
  }
};

export let runProviderTelemetryErrorGroupsExport = async (
  deps: ProviderTelemetryErrorGroupsExportDeps = {}
) => {
  let explicitBucketName = deps.bucketName === undefined ? undefined : deps.bucketName.trim();
  let defaultStorage =
    deps.storage || explicitBucketName === ''
      ? null
      : getProviderTelemetryErrorGroupsStorageTarget(explicitBucketName);
  let storage = deps.storage ?? defaultStorage?.storage;
  let bucketName = explicitBucketName ?? defaultStorage?.bucketName;
  let now = deps.now ?? new Date();
  let presentMessage = deps.presentMessage ?? createExportPayload;
  let listFailedMessages =
    deps.listFailedMessages ?? listProviderTelemetryFailedMessagesForExport;

  let emptyResult = {
    exportedKeys: [] as string[],
    quarantinedKeys: [] as string[],
    state: null as ProviderTelemetryFailedMessagesExportState | null,
    exportedCount: 0,
    quarantinedCount: 0,
    deferredCount: 0
  };

  if (!storage || !bucketName) return emptyResult;

  let store = storage;
  let bucket = bucketName;

  try {
    await store.upsertBucket(bucket);
  } catch (error) {
    if (isNotFoundError(error)) return emptyResult;
    throw error;
  }

  let state = await readProviderTelemetryErrorGroupsExportState({
    storage: store,
    bucketName: bucket
  });
  let range = getExportRange(state, now);

  let exportedKeys: string[] = [];
  let quarantinedKeys: string[] = [];
  let exportedCount = 0;
  let quarantinedCount = 0;
  let deferredCount = 0;
  let deferred = false;

  // `last_processed` covers exported and quarantined errors, never deferred
  // ones; `last_exported` keeps its legacy meaning so rollbacks resume safely.
  let lastProcessed = state?.last_processed ?? state?.last_exported ?? null;
  let lastExported = state?.last_exported ?? null;

  let writeState = async (status: 'running' | 'completed' | 'deferred') => {
    let nextState: ProviderTelemetryFailedMessagesExportState = {
      version: 2,
      last_exported: lastExported,
      last_checked_at: now.toISOString(),
      last_processed: lastProcessed,
      last_run: {
        status,
        exported_count: exportedCount,
        quarantined_count: quarantinedCount,
        deferred_count: deferredCount
      }
    };

    await writeJsonObject({
      storage: store,
      bucketName: bucket,
      key: PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY,
      value: nextState,
      metadata: {
        type: 'provider-telemetry-failed-messages-state'
      }
    });

    return nextState;
  };

  while (true) {
    let page = await listFailedMessages({
      range,
      limit: EXPORT_PAGE_SIZE,
      after: lastProcessed
    });

    if (!page.errors.length) break;

    let exportCandidates: ProviderTelemetryFailedMessageExportCandidate[] = [];
    let quarantineRecords: ProviderTelemetryFailedMessageQuarantineRecord[] = [];
    let processedThrough: ProviderTelemetryFailedMessagesExportWatermark | null = null;

    for (let index = 0; index < page.errors.length; index++) {
      let entry = page.errors[index]!;

      if (!entry.isReady) {
        let ageMs = now.getTime() - entry.occurredAt.getTime();

        if (ageMs < PROVIDER_TELEMETRY_EXPORT_READINESS_GRACE_MS) {
          // Grouping still pending: stop so the cursor never passes this error.
          deferred = true;
          deferredCount += page.errors.length - index;
          break;
        }

        quarantineRecords.push({
          object: 'provider_telemetry.failed_message_export_quarantine',
          version: 1,
          stage: 'readiness',
          reason: 'not_grouped_within_grace_period',
          error_id: entry.error.id,
          message_id: null,
          message_ids: entry.candidates.map(candidate => candidate.message.id),
          occurred_at: entry.occurredAt.toISOString(),
          fingerprint: fingerprintOf(['readiness', entry.error.type, entry.error.code]),
          quarantined_at: now.toISOString()
        });
        processedThrough = watermarkFor(entry.error.id, entry.occurredAt);
        continue;
      }

      exportCandidates.push(...entry.candidates);
      processedThrough = watermarkFor(entry.error.id, entry.occurredAt);
    }

    let prepared = await Promise.allSettled(
      exportCandidates.map(candidate => createExportItem({ candidate, presentMessage }))
    );

    let chunkCandidates: ProviderTelemetryFailedMessageExportCandidate[] = [];
    let chunkItems: unknown[] = [];

    for (let index = 0; index < prepared.length; index++) {
      let result = prepared[index]!;
      let candidate = exportCandidates[index]!;

      if (result.status === 'fulfilled') {
        chunkCandidates.push(candidate);
        chunkItems.push(result.value);
        continue;
      }

      // Only data-shaped failures are quarantined; anything else aborts the
      // run so state never advances.
      if (!(result.reason instanceof ProviderTelemetryExportItemError)) {
        throw result.reason;
      }

      let cause = result.reason.causedBy;
      quarantineRecords.push({
        object: 'provider_telemetry.failed_message_export_quarantine',
        version: 1,
        stage: result.reason.stage,
        reason: result.reason.stage === 'redact' ? 'redaction_failed' : 'presentation_failed',
        error_id: candidate.error.id,
        message_id: candidate.message.id,
        occurred_at: candidate.occurredAt.toISOString(),
        fingerprint: fingerprintOf([
          result.reason.stage,
          cause instanceof Error ? cause.name : typeof cause,
          cause instanceof Error ? cause.message : String(cause)
        ]),
        quarantined_at: now.toISOString()
      });
    }

    if (chunkItems.length) {
      let exportKey = getProviderTelemetryFailedMessagesExportChunkKey(chunkCandidates);

      // Rewriting an existing key changes its ETag and re-triggers downstream
      // ingestion; identical member sets reuse the object.
      let exists = await objectExists({ storage: store, bucketName: bucket, key: exportKey });
      if (!exists) {
        await writeJsonObject({
          storage: store,
          bucketName: bucket,
          key: exportKey,
          value: createExportChunk({ items: chunkItems, range, now }),
          metadata: {
            type: 'provider-telemetry-failed-message-export-chunk',
            itemCount: String(chunkItems.length)
          }
        });
      }

      exportedKeys.push(exportKey);
      exportedCount += chunkItems.length;

      let lastChunkCandidate = chunkCandidates[chunkCandidates.length - 1]!;
      lastExported = watermarkFor(lastChunkCandidate.error.id, lastChunkCandidate.occurredAt);
    }

    for (let record of quarantineRecords) {
      let quarantineKey = getProviderTelemetryFailedMessageQuarantineKey(record);

      let exists = await objectExists({
        storage: store,
        bucketName: bucket,
        key: quarantineKey
      });
      if (!exists) {
        await store.putObject(
          bucket,
          quarantineKey,
          `${JSON.stringify(record)}\n`,
          'application/x-ndjson',
          {
            type: 'provider-telemetry-failed-message-export-quarantine'
          }
        );
      }

      quarantinedKeys.push(quarantineKey);
      quarantinedCount += 1;
      captureQuarantineDiagnostics(record, quarantineKey);
    }

    if (processedThrough) lastProcessed = processedThrough;

    if (deferred || !page.hasMore) break;

    // Checkpoint so a crash cannot roll the cursor back to the run start.
    await writeState('running');
  }

  let nextState = await writeState(deferred ? 'deferred' : 'completed');

  console.log(
    '[PROVIDER TELEMETRY EXPORT]:',
    JSON.stringify({
      exportedCount,
      quarantinedCount,
      deferredCount,
      lastProcessed,
      lastExported
    })
  );

  return {
    exportedKeys,
    quarantinedKeys,
    state: nextState,
    exportedCount,
    quarantinedCount,
    deferredCount
  };
};
