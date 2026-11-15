import { ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { sha256Hex } from '@mtsrc/agent-tracking-crypto';
import {
  dialectManifests,
  hookDialectFor,
  isVersionSupported,
  mapOtlpDecoded,
  otlpChannel,
  resolveBulkDialect
} from '@mtsrc/agent-tracking-dialects';
import {
  decodeOtlp,
  OtlpDecodeError,
  otlpLimits,
  tooManyItemsError
} from '@mtsrc/agent-tracking-otlp';
import {
  assertIngestAllowed,
  clientNotAllowedError,
  isClientAllowed,
  normalizeClient
} from '@mtsrc/agent-tracking-records-model';
import {
  bulkBatchHeaderSchema,
  bulkItemSchema,
  type BulkBatchHeader,
  type BulkDialect,
  type BulkRejection,
  type BulkRejectionCode,
  type BulkResponse,
  type OtlpSignal
} from '@mtsrc/agent-tracking-spec';
import { createCollector } from '../lib/collector';
import type { IngestCall } from '../lib/call';
import {
  invalidBatchHeaderError,
  invalidClientError,
  invalidPayloadError
} from '../lib/errors';
import {
  isPlainObject,
  parseJsonObject,
  parseJsonObjectBytes,
  parseTimestamp
} from '../lib/payload';
import { getRuntime } from '../lib/runtime';

let maxHeaderBytes = 4096;
let maxItemBytes = 1024 * 1024;
let maxListedRejections = 1000;
let maxDetailLength = 160;
let maxFieldLength = 128;
let maxSourceRefLength = 512;
let maxClientVersionLength = 64;
let millisPerDay = 86_400_000;

let headerFieldPattern = /^[\x20-\x7e]{1,128}$/;

let signalByRootKey: Record<string, OtlpSignal> = {
  resourceLogs: 'logs',
  resourceMetrics: 'metrics',
  resourceSpans: 'traces'
};

type BulkItem = {
  client: string;
  client_version?: string;
  channel: string;
  dialect: string;
  source: { kind: string; ref: string; seq?: number };
  observed_at?: string;
  payload?: Record<string, unknown>;
  payload_line?: string;
};

let invalid = (message: string) => new ServiceError(invalidPayloadError({ message }));

class IngestServiceImpl {
  async ingestOtlp(d: {
    call: IngestCall;
    signal?: OtlpSignal;
    payloadType: 'protobuf' | 'json';
    bytes: Uint8Array;
  }) {
    let { principal } = d.call;
    let signal = d.signal;

    if (!signal) {
      if (d.payloadType != 'json') {
        throw invalid(
          'Protobuf payloads must be sent to /v1/logs, /v1/metrics or /v1/traces.'
        );
      }

      signal = this.inferOtlpSignal(d.bytes) ?? undefined;

      if (!signal) {
        throw invalid(
          'The payload must contain exactly one of resourceLogs, resourceMetrics or resourceSpans.'
        );
      }

      let denied = assertIngestAllowed(principal, { channel: otlpChannel(signal) });
      if (denied) throw new ServiceError(denied);
    }

    let decoded;

    try {
      decoded = decodeOtlp(signal, d.payloadType, d.bytes);
    } catch (error) {
      if (error instanceof OtlpDecodeError) {
        throw invalid(`The OTLP payload could not be decoded: ${error.message}.`);
      }

      throw error;
    }

    if (decoded.itemCount > otlpLimits.maxItems) throw new ServiceError(tooManyItemsError());

    let mapped = mapOtlpDecoded(signal, decoded);
    let collector = createCollector(d.call, { route: 'otlp_http', lane: 'live' });

    let notAllowed = 0;
    let unbuildable = 0;

    mapped.groups.forEach((group, index) => {
      if (!isClientAllowed(principal, group.dialect.client)) {
        notAllowed += decoded.groups[index]!.items.length;
        return;
      }

      for (let entry of group.mapped) {
        if (!collector.add([entry])) unbuildable++;
      }
    });

    if (notAllowed > 0 && notAllowed == decoded.itemCount) {
      throw new ServiceError(clientNotAllowedError());
    }

    await collector.flush();

    let rejected = decoded.malformed + mapped.failed + notAllowed + unbuildable;

    if (rejected == 0) return { signal, rejected, message: undefined };

    let reasons = [
      decoded.malformed > 0 ? `${decoded.malformed} malformed` : '',
      mapped.failed + unbuildable > 0
        ? `${mapped.failed + unbuildable} could not be mapped`
        : '',
      notAllowed > 0 ? `${notAllowed} for clients this token may not use` : ''
    ].filter(Boolean);

    return { signal, rejected, message: `Rejected: ${reasons.join(', ')}.` };
  }

  async ingestHooks(d: {
    call: IngestCall;
    client: string;
    eventId?: string;
    observedAt?: Date | null;
    bytes: Uint8Array;
  }) {
    let client = normalizeClient(d.client);
    if (!client) throw new ServiceError(invalidClientError());

    if (d.bytes.length == 0) throw invalid('The request body is empty.');

    let payload = parseJsonObjectBytes(d.bytes);
    if (!payload) throw invalid('The hook payload must be a JSON object.');

    let identityHint = d.eventId ? `id:${d.eventId}` : `body:${sha256Hex(d.bytes)}`;

    let mapped;

    try {
      mapped = hookDialectFor(client).map({ identityHint }, payload);
    } catch {
      throw invalid('The hook payload could not be mapped.');
    }

    let collector = createCollector(d.call, {
      route: 'hook',
      lane: 'live',
      arrivalIsEventTime: true
    });

    if (!collector.add(mapped, d.observedAt)) {
      throw invalid('The hook payload could not be mapped.');
    }

    let accepted = await collector.flush();

    return { accepted };
  }

  async ingestBulk(d: {
    call: IngestCall;
    lines: AsyncGenerator<string, void, unknown>;
  }): Promise<BulkResponse> {
    let first = await d.lines.next();
    let header = first.done ? null : this.parseBulkHeader(first.value);

    if (!header) {
      await d.lines.return(undefined);

      throw new ServiceError(invalidBatchHeaderError());
    }

    let { principal } = d.call;
    let lane = header.mode == 'backfill' ? ('backfill' as const) : ('live' as const);
    let now = getRuntime().clock().getTime();

    let maxAgeDays =
      principal.instance.backfillMaxAgeDays ?? principal.instance.recordRetentionDays;
    let oldestAllowed = lane == 'backfill' ? now - maxAgeDays * millisPerDay : null;

    let latestAllowed = now + principal.instance.skewBoundSeconds * 1000;

    let collector = createCollector(d.call, {
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

    for await (let line of d.lines) {
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
          reject('parse_error', this.describeFirstError(validated.errors));
          continue;
        }

        let item = validated.value as BulkItem;

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

    return { batch_id: header.batch_id, accepted, rejected, rejections };
  }

  async listBulkDialects(): Promise<BulkDialect[]> {
    return dialectManifests.map(manifest => ({
      client: manifest.client,
      channel: manifest.channel,
      dialect: manifest.dialect,
      ...(manifest.minVersion ? { min_version: manifest.minVersion } : {}),
      ...(manifest.maxVersion ? { max_version: manifest.maxVersion } : {})
    }));
  }

  private inferOtlpSignal(bytes: Uint8Array): OtlpSignal | null {
    let root = parseJsonObjectBytes(bytes);
    if (!root) return null;

    let present = Object.keys(signalByRootKey).filter(key => Object.hasOwn(root, key));

    return present.length == 1 ? signalByRootKey[present[0]!]! : null;
  }

  private parseBulkHeader(line: string): BulkBatchHeader | null {
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
    if (!fields.every(this.isHeaderField)) return null;
    if (!parseTimestamp(header.sent_at)) return null;

    return header;
  }

  private isHeaderField(value: string) {
    return (
      value.length <= maxFieldLength &&
      value.trim().length > 0 &&
      headerFieldPattern.test(value)
    );
  }

  private describeFirstError(errors: { code: string; path?: string[] }[]) {
    let first = errors[0];
    if (!first) return 'invalid item';

    let path = first.path?.join('.');

    return (path ? `${path}: ${first.code}` : first.code).slice(0, maxDetailLength);
  }
}

export let ingestService = Service.create(
  'ingestService',
  () => new IngestServiceImpl()
).build();
