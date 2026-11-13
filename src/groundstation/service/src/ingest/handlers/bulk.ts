import {
  bulkBatchHeaderSchema,
  bulkItemSchema,
  type BulkBatchHeader,
  type BulkDialect,
  type BulkRejection,
  type BulkRejectionCode,
  type BulkResponse
} from '@metorial/groundstation-spec';
import { assertIngestAllowed } from '../../auth/principal';
import {
  dialectManifests,
  isVersionSupported,
  resolveBulkDialect
} from '../../dialects/registry';
import { normalizeClient } from '../../records/clients';
import { getRuntime } from '../../runtime';
import { readNdjsonLines } from '../body';
import { createCollector } from '../emit';
import { invalidBatchHeaderError } from '../errors';
import { isPlainObject, parseJsonObject, parseTimestamp } from '../payload';
import type { IngestHandler, PublicIngestHandler } from '../request';
import { errorResponse, jsonResponse } from '../response';

let maxHeaderBytes = 4096;
let maxItemBytes = 1024 * 1024;
let maxListedRejections = 1000;
let maxDetailLength = 160;
let maxFieldLength = 128;
let maxSourceRefLength = 512;
let maxClientVersionLength = 64;
let millisPerDay = 86_400_000;

let headerFieldPattern = /^[\x20-\x7e]{1,128}$/;

type Item = {
  client: string;
  client_version?: string;
  channel: string;
  dialect: string;
  source: { kind: string; ref: string; seq?: number };
  observed_at?: string;
  payload?: Record<string, unknown>;
  payload_line?: string;
};

let isHeaderField = (value: string) =>
  value.length <= maxFieldLength && value.trim().length > 0 && headerFieldPattern.test(value);

let parseHeader = (line: string): BulkBatchHeader | null => {
  if (Buffer.byteLength(line) > maxHeaderBytes) return null;

  let value = parseJsonObject(line);
  if (!value) return null;

  let result = bulkBatchHeaderSchema.validate(value);
  if (!result.success) return null;

  let header = result.value;

  let fields = [
    header.batch_id,
    header.agent.name,
    header.agent.version,
    header.agent.install_id
  ];
  if (!fields.every(isHeaderField)) return null;
  if (!parseTimestamp(header.sent_at)) return null;

  return header;
};

let describeFirstError = (errors: { code: string; path?: string[] }[]) => {
  let first = errors[0];
  if (!first) return 'invalid item';

  let path = first.path?.join('.');

  return (path ? `${path}: ${first.code}` : first.code).slice(0, maxDetailLength);
};

export let bulkIngestHandler: IngestHandler = async request => {
  let lines = readNdjsonLines(request.body);

  let first = await lines.next();
  let header = first.done ? null : parseHeader(first.value);

  if (!header) {
    await lines.return(undefined);

    return errorResponse(invalidBatchHeaderError());
  }

  let { principal } = request;
  let runtime = getRuntime();
  let lane = header.mode == 'backfill' ? ('backfill' as const) : ('live' as const);
  let now = runtime.clock().getTime();

  let maxAgeDays =
    principal.instance.backfillMaxAgeDays ?? principal.instance.recordRetentionDays;
  let oldestAllowed = lane == 'backfill' ? now - maxAgeDays * millisPerDay : null;

  let latestAllowed = now + principal.instance.skewBoundSeconds * 1000;

  let collector = createCollector(request, {
    route: 'bulk',
    lane,
    batchId: header.batch_id,
    agent: {
      name: header.agent.name,
      version: header.agent.version,
      install_id: header.agent.install_id
    }
  });

  let rejections: BulkRejection[] = [];
  let rejected = 0;
  let accepted = 0;
  let index = 0;

  let reject = (code: BulkRejectionCode, detail?: string) => {
    rejected++;

    if (rejections.length < maxListedRejections) {
      rejections.push({ i: index, code, ...(detail ? { detail } : {}) });
    }
  };

  for await (let line of lines) {
    try {
      if (Buffer.byteLength(line) > maxItemBytes) {
        reject('too_large');
        continue;
      }

      let raw = parseJsonObject(line);

      if (!raw) {
        reject('parse_error', 'The line is not a JSON object.');
        continue;
      }

      let validated = bulkItemSchema.validate(raw);

      if (!validated.success) {
        reject('parse_error', describeFirstError(validated.errors));
        continue;
      }

      let item = validated.value as Item;

      let client = normalizeClient(item.client);

      if (!client) {
        reject('unknown_client');
        continue;
      }

      if (assertIngestAllowed(principal, { client, channel: item.channel })) {
        reject('not_allowed');
        continue;
      }

      let resolution = resolveBulkDialect(client, item.channel, item.dialect);

      if (!resolution.ok) {
        reject(resolution.code);
        continue;
      }

      if (
        (item.client_version && item.client_version.length > maxClientVersionLength) ||
        !isVersionSupported(resolution.manifest, item.client_version)
      ) {
        reject('unsupported_version');
        continue;
      }

      if (
        item.source.kind.length > maxFieldLength ||
        item.source.ref.length > maxSourceRefLength ||
        (item.source.seq !== undefined &&
          (!Number.isSafeInteger(item.source.seq) || item.source.seq < 0))
      ) {
        reject('parse_error', 'source is not valid.');
        continue;
      }

      let observedAt = item.observed_at ? parseTimestamp(item.observed_at) : null;

      if (item.observed_at && !observedAt) {
        reject('parse_error', 'observed_at must be an RFC 3339 timestamp.');
        continue;
      }

      if (lane == 'backfill') {
        if (!observedAt) {
          reject('parse_error', 'observed_at is required in backfill mode.');
          continue;
        }

        if (observedAt.getTime() > latestAllowed) {
          reject('parse_error', 'observed_at is in the future.');
          continue;
        }

        if (oldestAllowed !== null && observedAt.getTime() < oldestAllowed) {
          reject('too_old');
          continue;
        }
      }

      if ((item.payload === undefined) == (item.payload_line === undefined)) {
        reject('parse_error', 'Exactly one of payload and payload_line is required.');
        continue;
      }

      let payload = item.payload ?? parseJsonObject(item.payload_line!);

      if (!isPlainObject(payload)) {
        reject('parse_error', 'The payload must be a JSON object.');
        continue;
      }

      let identityHint = `${item.source.kind}|${item.source.ref}|${item.source.seq ?? ''}`;

      let mapped = resolution.dialect.map({ identityHint }, payload);

      if (!collector.add(mapped, observedAt)) {
        reject('parse_error', 'The payload could not be mapped.');
        continue;
      }

      accepted++;
    } catch {
      reject('parse_error', 'The item could not be processed.');
    } finally {
      index++;
    }
  }

  await collector.flush();

  let body: BulkResponse = {
    batch_id: header.batch_id,
    accepted,
    rejected,
    rejections
  };

  return jsonResponse(200, body);
};

export let bulkDialectsHandler: PublicIngestHandler = async () => {
  let items: BulkDialect[] = dialectManifests.map(manifest => ({
    client: manifest.client,
    channel: manifest.channel,
    dialect: manifest.dialect,
    ...(manifest.minVersion ? { min_version: manifest.minVersion } : {}),
    ...(manifest.maxVersion ? { max_version: manifest.maxVersion } : {})
  }));

  return jsonResponse(200, { object: 'groundstation#bulk_dialects', items });
};
