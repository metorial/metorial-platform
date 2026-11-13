import type { ContentRole, NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import mongoose from 'mongoose';
import type { StoragePolicy } from '@mtsrc/agent-tracking-store';
import { contentAad, type ContentCipher } from '@mtsrc/agent-tracking-crypto';
import type {
  ContentTextDocument,
  RecordDocument,
  StoredContentEntry,
  StoredExtra
} from '@mtsrc/agent-tracking-store';

let millisPerDay = 86_400_000;
let keyCacheLimit = 10_000;
let decimalPattern = /^-?\d{1,18}(\.\d{1,18})?$/;

export type PendingText = {
  recordId: string;
  index: number;
  role: ContentRole;
  text: string;
  occurredAt: Date;
  expiresAt: Date;
};

export type MappedBatch = {
  events: RecordDocument[];
  measurements: RecordDocument[];
  texts: PendingText[];
  expired: number;
};

let keyCache = new Map<string, string>();

export let storedKey = (key: string) => {
  let cached = keyCache.get(key);
  if (cached !== undefined) return cached;

  let converted = key
    .replace(/[_-]+([a-zA-Z0-9])/g, (_, next: string) => next.toUpperCase())
    .replace(/\./g, '_')
    .replace(/^\$/, '_');

  if (keyCache.size < keyCacheLimit) keyCache.set(key, converted);

  return converted;
};

let isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value == 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

let isCost = (value: Record<string, unknown>) =>
  typeof value.amount == 'string' &&
  typeof value.unit == 'string' &&
  decimalPattern.test(value.amount);

export let toStoredValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toStoredValue);
  if (!isPlainObject(value)) return value;

  let result: Record<string, unknown> = {};

  for (let [key, nested] of Object.entries(value)) {
    if (nested === undefined) continue;

    result[storedKey(key)] = toStoredValue(nested);
  }

  if (isCost(value)) {
    result.amount = mongoose.Types.Decimal128.fromString(value.amount as string);
  }

  return result;
};

let toDate = (value: unknown) => {
  if (typeof value != 'string') return value;

  let date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date;
};

let toMeasurementData = (data: Record<string, unknown>) => {
  let stored = toStoredValue(data) as Record<string, unknown>;

  if (isPlainObject(stored.window)) {
    stored.window = {
      start: toDate(stored.window.start),
      end: toDate(stored.window.end)
    };
  }

  return stored;
};

let nonEmpty = (values: string[]) => (values.length ? values : undefined);

let addDays = (date: Date, days: number) => new Date(date.getTime() + days * millisPerDay);

let toExtras = (extras: NormalizedRecord['extras']): StoredExtra[] | undefined => {
  let entries = Object.entries(extras);

  return entries.length ? entries.map(([k, v]) => ({ k, v })) : undefined;
};

let toContent = (
  record: NormalizedRecord,
  occurredAt: Date,
  textExpiresAt: Date,
  storeText: boolean
) => {
  let entries: StoredContentEntry[] = [];
  let texts: PendingText[] = [];

  for (let [index, entry] of record.content.entries()) {
    let hasText = storeText && typeof entry.text == 'string';

    entries.push({
      role: entry.role,
      mode: entry.mode,
      state: entry.state,
      length: entry.length,
      hash: entry.hash,
      shape: entry.shape ? (toStoredValue(entry.shape) as Record<string, unknown>) : undefined,
      truncated: entry.truncated,
      originalLength: entry.original_length,
      hasText: hasText ? true : undefined
    });

    if (hasText) {
      texts.push({
        recordId: record.id,
        index,
        role: entry.role,
        text: entry.text!,
        occurredAt,
        expiresAt: textExpiresAt
      });
    }
  }

  return { entries: entries.length ? entries : undefined, texts };
};

export let toRecordDocument = (
  record: NormalizedRecord,
  d: { storage: StoragePolicy; now: Date }
): { document: RecordDocument; texts: PendingText[] } | null => {
  let occurredAt = new Date(record.occurred_at);
  let expiresAt = addDays(occurredAt, d.storage.recordRetentionDays);

  if (expiresAt <= d.now) return null;

  let contentExpiresAt = addDays(occurredAt, d.storage.contentRetentionDays);
  let textExpiresAt = contentExpiresAt < expiresAt ? contentExpiresAt : expiresAt;

  let content = toContent(record, occurredAt, textExpiresAt, textExpiresAt > d.now);

  let { ingest, source, client, actor, attribution, ctx, workspace, quality } = record;

  let document: RecordDocument = {
    _id: record.id,
    organizationId: ingest.organization_id,
    projectId: ingest.project_id,
    instanceId: ingest.instance_id,
    spec: record.spec,
    type: record.type,

    occurredAt,
    observedAt: new Date(record.observed_at),
    durationMs: record.duration_ms,
    expiresAt,

    ingest: {
      credentialKind: ingest.credential_kind,
      credentialId: ingest.credential_id,
      route: ingest.route,
      requestId: ingest.request_id,
      backfill: ingest.backfill,
      batchId: ingest.batch_id,
      agent: ingest.agent
        ? {
            name: ingest.agent.name,
            version: ingest.agent.version,
            installId: ingest.agent.install_id
          }
        : undefined
    },

    source: {
      adapter: source.adapter,
      dialect: source.dialect,
      channel: source.channel,
      signalName: source.signal_name,
      role: source.role,
      factKey: source.fact_key ?? undefined,
      nativeVersion: source.native_version
    },

    client: {
      family: client.family,
      surface: client.surface,
      version: client.version,
      authMode: client.auth_mode,
      terminal: client.terminal
    },

    actor: actor
      ? {
          installId: actor.install_id,
          user: actor.user,
          orgClaim: actor.org_claim,
          identitySource: actor.identity_source
        }
      : undefined,

    attribution: attribution
      ? {
          userId: attribution.user_id,
          deviceId: attribution.device_id,
          agentId: attribution.agent_id,
          clientUserId: attribution.client_user_id,
          clientInstallationId: attribution.client_installation_id,
          repoId: attribution.repo_id,
          workspaceId: attribution.workspace_id
        }
      : undefined,

    ctx: {
      sessionId: ctx.session_id,
      sessionKey: ctx.session_key,
      sessionOrigin: ctx.session_origin,
      parentSessionKey: ctx.parent_session_key,
      continuesSessionKey: ctx.continues_session_key,
      turnId: ctx.turn_id,
      requestId: ctx.request_id,
      generationId: ctx.generation_id,
      toolCallId: ctx.tool_call_id,
      agent: ctx.agent ? { id: ctx.agent.id, parentId: ctx.agent.parent_id } : undefined,
      trace: ctx.trace
        ? {
            traceId: ctx.trace.trace_id,
            spanId: ctx.trace.span_id,
            parentSpanId: ctx.trace.parent_span_id
          }
        : undefined
    },

    workspace: workspace ? { os: workspace.os, hostHash: workspace.host_hash } : undefined,

    data:
      record.kind == 'measurement'
        ? toMeasurementData(record.data)
        : (toStoredValue(record.data) as Record<string, unknown>),
    content: content.entries,
    extras: toExtras(record.extras),

    quality: {
      coerced: nonEmpty(quality.coerced),
      derived: nonEmpty(quality.derived),
      dropped: nonEmpty(quality.dropped),
      warnings: nonEmpty(quality.warnings),
      timeSource: quality.time_source
    }
  };

  return { document, texts: content.texts };
};

export let toDocuments = (
  records: NormalizedRecord[],
  d: { storage: StoragePolicy; now: Date }
): MappedBatch => {
  let mapped: MappedBatch = { events: [], measurements: [], texts: [], expired: 0 };

  for (let record of records) {
    let result = toRecordDocument(record, d);

    if (!result) {
      mapped.expired++;
      continue;
    }

    (record.kind == 'measurement' ? mapped.measurements : mapped.events).push(result.document);
    mapped.texts.push(...result.texts);
  }

  return mapped;
};

export let toContentTextDocuments = (
  texts: PendingText[],
  d: {
    organizationId: string;
    projectId: string;
    instanceId: string;
    storage: StoragePolicy;
    cipher: ContentCipher;
  }
): ContentTextDocument[] => {
  if (!texts.length) return [];

  let key = d.cipher.forOrganization({
    id: d.organizationId,
    contentKeyVersion: d.storage.contentKeyVersion
  });

  return texts.map(text => {
    let aad = contentAad({
      organizationId: d.organizationId,
      recordId: text.recordId,
      index: text.index,
      role: text.role
    });

    let encrypted = d.cipher.encrypt(key, text.text, aad);

    return {
      _id: `${text.recordId}:${text.index}`,
      organizationId: d.organizationId,
      projectId: d.projectId,
      instanceId: d.instanceId,
      recordId: text.recordId,
      index: text.index,
      role: text.role,

      keyVersion: key.version,
      iv: new mongoose.mongo.Binary(encrypted.iv),
      ciphertext: new mongoose.mongo.Binary(encrypted.ciphertext),

      occurredAt: text.occurredAt,
      expiresAt: text.expiresAt
    };
  });
};
