import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';
import { db } from '@metorial-subspace/db';
import { ObjectStorageClient } from 'object-storage-client';
import { sessionMessageService } from './sessionMessage';

export let PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY =
  'provider-telemetry/error-groups/failed-messages/state.json';

export let PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY =
  PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY;

let DEFAULT_EXPORT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
let WATERMARK_OVERLAP_MS = 60 * 60 * 1000;
let EXPORT_PAGE_SIZE = 100;
let REDACTED = '[redacted]';
let REDACTED_EMAIL = '[redacted-email]';

export type ProviderTelemetryFailedMessagesExportWatermark = {
  occurred_at: string;
  id: string;
};

export type ProviderTelemetryFailedMessagesExportState = {
  version: 2;
  last_exported: ProviderTelemetryFailedMessagesExportWatermark | null;
  last_checked_at: string;
};

export type ProviderTelemetryErrorGroupsExportState =
  ProviderTelemetryFailedMessagesExportState;

export type ProviderTelemetryFailedMessageExportFile = {
  object: 'admin.provider_error_group.failed_message_export';
  version: 1;
  generated_at: string;
  occurred_at: string;
  error_group_id: string;
  error_id: string;
  message_id: string;
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
  payload: unknown;
};

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

export type ProviderTelemetryFailedMessagesExportListInput = {
  range: { from: Date; to: Date };
  limit?: number;
  after?: ProviderTelemetryFailedMessagesExportWatermark | null;
};

export type ProviderTelemetryFailedMessagesExportList = {
  items: ProviderTelemetryFailedMessageExportCandidate[];
  nextWatermark: ProviderTelemetryFailedMessagesExportWatermark | null;
  hasMore: boolean;
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

let getExporterEnv = () =>
  createValidatedEnv({
    storage: {
      OBJECT_STORAGE_URL: v.optional(v.string()),
      PROVIDER_TELEMETRY_ERROR_GROUPS_BUCKET_NAME: v.optional(v.string())
    }
  }).storage;

let getDefaultStorage = (bucketNameOverride?: string | null) => {
  let env = getExporterEnv();
  let bucketName =
    bucketNameOverride?.trim() || env.PROVIDER_TELEMETRY_ERROR_GROUPS_BUCKET_NAME?.trim();
  if (!bucketName) return null;

  let objectStorageUrl = env.OBJECT_STORAGE_URL?.trim();
  if (!objectStorageUrl) {
    throw new Error(
      'OBJECT_STORAGE_URL is required when PROVIDER_TELEMETRY_ERROR_GROUPS_BUCKET_NAME is configured'
    );
  }

  return {
    bucketName,
    storage: new ObjectStorageClient(objectStorageUrl)
  };
};

let objectDataToString = (data: Buffer | Uint8Array | string) => {
  if (typeof data === 'string') return data;
  return Buffer.from(data).toString('utf8');
};

let isNotFoundError = (error: unknown) =>
  !!error &&
  typeof error === 'object' &&
  'statusCode' in error &&
  (error as { statusCode?: number }).statusCode === 404;

export let readProviderTelemetryErrorGroupsExportState = async (d: {
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
  watermark: ProviderTelemetryFailedMessagesExportWatermark | null | undefined,
  now: Date
) => {
  let from = watermark
    ? new Date(new Date(watermark.occurred_at).getTime() - WATERMARK_OVERLAP_MS)
    : new Date(now.getTime() - DEFAULT_EXPORT_LOOKBACK_MS);

  return { from, to: now };
};

export let watermarkFromProviderTelemetryFailedMessage = (
  item: Pick<ProviderTelemetryFailedMessageExportCandidate, 'error' | 'occurredAt'>
): ProviderTelemetryFailedMessagesExportWatermark => ({
  occurred_at: item.occurredAt.toISOString(),
  id: item.error.id
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
        { groupOid: { not: null } },
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
  let rawMessages = pageErrors.flatMap(error => error.sessionMessages);
  let enrichedMessages = await sessionMessageService.enrichMessages(rawMessages as any);
  let enrichedMessageMap = new Map(enrichedMessages.map(message => [message.oid, message]));

  let items = pageErrors.flatMap(error =>
    error.sessionMessages.map(rawMessage => {
      let message = enrichedMessageMap.get(rawMessage.oid) ?? rawMessage;

      return {
        error,
        message,
        occurredAt: error.createdAt,
        provider: providerFromCandidate(error, message),
        tool: toolFromMessage(message)
      };
    })
  );

  let lastError = pageErrors[pageErrors.length - 1];

  return {
    items,
    nextWatermark: lastError
      ? {
          occurred_at: lastError.createdAt.toISOString(),
          id: lastError.id
        }
      : null,
    hasMore: errors.length > limit
  };
};

let collectFailedMessages = async (d: {
  listFailedMessages: ProviderTelemetryErrorGroupsExportDeps['listFailedMessages'];
  range: { from: Date; to: Date };
}) => {
  let items: ProviderTelemetryFailedMessageExportCandidate[] = [];
  let after: ProviderTelemetryFailedMessagesExportWatermark | null = null;
  let listFailedMessages =
    d.listFailedMessages ?? listProviderTelemetryFailedMessagesForExport;

  while (true) {
    let page = await listFailedMessages({
      range: d.range,
      limit: EXPORT_PAGE_SIZE,
      after
    });

    items.push(...page.items);
    if (!page.hasMore || !page.nextWatermark) break;

    after = page.nextWatermark;
  }

  return items;
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

let normalizedKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

let isIdKey = (key: string) => {
  let normalized = normalizedKey(key);
  return normalized === 'id' || normalized.endsWith('id') || normalized.endsWith('ids');
};

let isSensitiveKey = (key: string) => {
  if (isIdKey(key)) return false;

  let normalized = normalizedKey(key);
  return [
    'authorization',
    'cookie',
    'setcookie',
    'token',
    'accesstoken',
    'refreshtoken',
    'apikey',
    'clientsecret',
    'password',
    'passwd',
    'privatekey',
    'secret',
    'credential',
    'credentials',
    'privatemetadata'
  ].some(part => normalized.includes(part));
};

let isSensitiveQueryParam = (key: string) =>
  [
    'token',
    'accesstoken',
    'refreshtoken',
    'apikey',
    'key',
    'clientsecret',
    'password',
    'secret'
  ].includes(normalizedKey(key));

let redactUrlQuerySecrets = (value: string) =>
  value.replace(/\bhttps?:\/\/[^\s"'<>]+/g, match => {
    try {
      let url = new URL(match);
      for (let key of Array.from(url.searchParams.keys())) {
        if (isSensitiveQueryParam(key)) url.searchParams.set(key, REDACTED);
      }
      return url.toString();
    } catch (_err) {
      return match;
    }
  });

let redactString = (value: string) =>
  redactUrlQuerySecrets(value)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED_EMAIL);

export let anonymizeProviderTelemetryExportValue = (value: unknown, key?: string): unknown => {
  if (key && isSensitiveKey(key)) return REDACTED;
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;

  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => anonymizeProviderTelemetryExportValue(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      anonymizeProviderTelemetryExportValue(entryValue, entryKey)
    ])
  );
};

let sanitizeS3KeyComponent = (value: string | null | undefined) => {
  let sanitized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 120);

  return sanitized || 'unknown';
};

let messageDetailForKey = (candidate: ProviderTelemetryFailedMessageExportCandidate) =>
  candidate.message.toolCall?.tool?.key ??
  candidate.message.toolCall?.toolKey ??
  candidate.message.methodOrToolKey ??
  candidate.error.code ??
  candidate.message.id;

export let getProviderTelemetryFailedMessageExportKey = (
  candidate: ProviderTelemetryFailedMessageExportCandidate
) => {
  let unixSeconds = Math.floor(candidate.occurredAt.getTime() / 1000);
  let filename = [
    candidate.provider?.slug,
    candidate.message.type,
    messageDetailForKey(candidate),
    String(unixSeconds)
  ]
    .map(sanitizeS3KeyComponent)
    .join('-');

  return ['provider-telemetry', `${filename}.json`].join('/');
};

let defaultPresentMessage = async (message: any) => {
  let { sessionMessagePresenter } = await import('@metorial-subspace/presenters');
  return await sessionMessagePresenter(message);
};

let createExportFile = async (d: {
  candidate: ProviderTelemetryFailedMessageExportCandidate;
  now: Date;
  presentMessage: (message: any) => Promise<unknown>;
}): Promise<ProviderTelemetryFailedMessageExportFile> => {
  let payload = await d.presentMessage(d.candidate.message);

  return {
    object: 'admin.provider_error_group.failed_message_export',
    version: 1,
    generated_at: d.now.toISOString(),
    occurred_at: d.candidate.occurredAt.toISOString(),
    error_group_id: d.candidate.error.group.id,
    error_id: d.candidate.error.id,
    message_id: d.candidate.message.id,
    provider: d.candidate.provider,
    tool: d.candidate.tool,
    payload: anonymizeProviderTelemetryExportValue(payload)
  };
};

export let runProviderTelemetryErrorGroupsExport = async (
  deps: ProviderTelemetryErrorGroupsExportDeps = {}
) => {
  let explicitBucketName = deps.bucketName === undefined ? undefined : deps.bucketName.trim();
  let defaultStorage =
    deps.storage || explicitBucketName === '' ? null : getDefaultStorage(explicitBucketName);
  let storage = deps.storage ?? defaultStorage?.storage;
  let bucketName = explicitBucketName ?? defaultStorage?.bucketName;
  let now = deps.now ?? new Date();
  let presentMessage = deps.presentMessage ?? defaultPresentMessage;

  if (!storage || !bucketName) {
    return {
      exportedKeys: [],
      state: null,
      exportedCount: 0
    };
  }

  try {
    await storage.upsertBucket(bucketName);
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        exportedKeys: [],
        state: null,
        exportedCount: 0
      };
    }

    throw error;
  }

  let state = await readProviderTelemetryErrorGroupsExportState({ storage, bucketName });
  let watermarkBefore = state?.last_exported ?? null;
  let range = getExportRange(watermarkBefore, now);
  let items = await collectFailedMessages({
    listFailedMessages: deps.listFailedMessages,
    range
  });

  let exportedKeys: string[] = [];

  for (let item of items) {
    let exportKey = getProviderTelemetryFailedMessageExportKey(item);
    let exportFile = await createExportFile({
      candidate: item,
      now,
      presentMessage
    });

    await writeJsonObject({
      storage,
      bucketName,
      key: exportKey,
      value: exportFile,
      metadata: {
        type: 'provider-telemetry-failed-message-export',
        messageId: item.message.id,
        errorId: item.error.id,
        errorGroupId: item.error.group.id
      }
    });

    exportedKeys.push(exportKey);
  }

  let watermarkAfter = items.length
    ? watermarkFromProviderTelemetryFailedMessage(items[items.length - 1]!)
    : watermarkBefore;
  let nextState: ProviderTelemetryFailedMessagesExportState = {
    version: 2,
    last_exported: watermarkAfter,
    last_checked_at: now.toISOString()
  };

  await writeJsonObject({
    storage,
    bucketName,
    key: PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY,
    value: nextState,
    metadata: {
      type: 'provider-telemetry-failed-messages-state'
    }
  });

  return {
    exportedKeys,
    state: nextState,
    exportedCount: exportedKeys.length
  };
};
