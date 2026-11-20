import { gzipSync } from 'node:zlib';
import { Reader } from '@mtsrc/agent-tracking-otlp';
import {
  encodeLogsRequest,
  jsonBytes,
  logsJson,
  type Group,
  type LogDesc
} from '@mtsrc/agent-tracking-testing';
import { dayMs } from '../lib/clock';
import { createSampler, seedOf, stableHex, uuidOf } from '../lib/random';
import type { TrafficProfile } from './profile';

export type PayloadFormat = 'protobuf' | 'json';

export type Compression = 'none' | 'gzip';

export type EncodedRequest = {
  path: string;
  headers: Record<string, string>;
  body: Uint8Array;
  records: number;
  lane: 'live' | 'backfill';
};

let contentTypes: Record<PayloadFormat, string> = {
  protobuf: 'application/x-protobuf',
  json: 'application/json'
};

let compress = (body: Uint8Array, compression: Compression) =>
  compression == 'gzip' ? new Uint8Array(gzipSync(body)) : body;

let compressionHeaders = (compression: Compression): Record<string, string> =>
  compression == 'gzip' ? { 'content-encoding': 'gzip' } : {};

export let encodeLiveRequest = (
  group: Group<LogDesc>,
  records: number,
  options: { format: PayloadFormat; compression: Compression }
): EncodedRequest => {
  let raw =
    options.format == 'protobuf' ? encodeLogsRequest([group]) : jsonBytes(logsJson([group]));

  return {
    path: '/v1/logs',
    headers: {
      'content-type': contentTypes[options.format],
      ...compressionHeaders(options.compression)
    },
    body: compress(raw, options.compression),
    records,
    lane: 'live'
  };
};

type BackfillItem = {
  client: 'claude-code';
  channel: 'hook';
  dialect: 'claude-code.hooks.v1';
  source: { kind: 'transcript'; ref: string; seq: number };
  observed_at: string;
  payload: Record<string, unknown>;
};

export let backfillExpectedTypes = [
  'session.start',
  'tool.call',
  'turn.completed',
  'session.end'
];

// Hook payloads as a desktop agent replays them from local transcripts: lifecycle and tool
// events only, without prompts, tool input, responses or paths.
export let backfillItems = (d: {
  profile: TrafficProfile;
  seed: number;
  batchNumber: number;
  now: number;
}): BackfillItem[] => {
  let sampler = createSampler(seedOf(d.seed, 'backfill', d.batchNumber));
  let items: BackfillItem[] = [];
  let sessionNumber = 0;

  while (items.length < d.profile.backfill.itemsPerRequest) {
    let sessionId = uuidOf(d.seed, 'backfill-session', d.batchNumber, sessionNumber);
    let ref = `transcript-${stableHex(16, d.seed, d.batchNumber, sessionNumber)}`;
    let started = d.now - sampler.next() * d.profile.backfill.maxAgeDays * dayMs;
    let seq = 0;
    let at = started;

    let push = (payload: Record<string, unknown>) => {
      at += sampler.count({ median: 4_000, p90: 30_000, min: 10, max: 600_000 });
      items.push({
        client: 'claude-code',
        channel: 'hook',
        dialect: 'claude-code.hooks.v1',
        source: { kind: 'transcript', ref, seq: seq++ },
        observed_at: new Date(Math.min(at, d.now)).toISOString(),
        payload: { session_id: sessionId, ...payload }
      });
    };

    push({ hook_event_name: 'SessionStart', source: 'startup' });

    let turns = sampler.count(d.profile.turnsPerSession);

    for (
      let turn = 0;
      turn < turns && items.length < d.profile.backfill.itemsPerRequest;
      turn++
    ) {
      let promptId = uuidOf(sessionId, 'prompt', turn);
      let calls = sampler.count({ median: 3, p90: 12, min: 0, max: 60 });

      for (let call = 0; call < calls; call++) {
        push({
          hook_event_name: 'PostToolUse',
          prompt_id: promptId,
          tool_use_id: `toolu_${stableHex(24, sessionId, turn, call)}`,
          tool_name: sampler.weighted(d.profile.tools),
          duration_ms: sampler.count(d.profile.toolDurationMs)
        });
      }

      push({ hook_event_name: 'Stop', prompt_id: promptId });
    }

    push({ hook_event_name: 'SessionEnd', reason: 'other' });
    sessionNumber++;
  }

  return items.slice(0, d.profile.backfill.itemsPerRequest);
};

export let encodeBackfillRequest = (
  items: BackfillItem[],
  options: { batchId: string; now: number; compression: Compression }
): EncodedRequest => {
  let header = {
    batch_id: options.batchId,
    mode: 'backfill',
    sent_at: new Date(options.now).toISOString(),
    agent: { name: 'agent-tracking-loadtest', version: '1.0.0', install_id: 'loadtest' }
  };

  let text = [header, ...items].map(line => JSON.stringify(line)).join('\n') + '\n';

  return {
    path: '/v1/bulk',
    headers: {
      'content-type': 'application/x-ndjson',
      ...compressionHeaders(options.compression)
    },
    body: compress(new TextEncoder().encode(text), options.compression),
    records: items.length,
    lane: 'backfill'
  };
};

// ExportLogsServiceResponse.partial_success.rejected_log_records.
export let rejectedOfOtlpResponse = (bytes: Uint8Array, contentType: string | null) => {
  if (bytes.length == 0) return 0;

  if (contentType?.includes('json')) {
    let parsed = JSON.parse(new TextDecoder().decode(bytes));

    return Number(parsed?.partialSuccess?.rejectedLogRecords ?? 0);
  }

  let response = new Reader(bytes);

  while (response.next()) {
    if (response.field != 1 || response.wire != 2) {
      response.skip();
      continue;
    }

    let partial = response.message();
    while (partial.next()) {
      if (partial.field == 1 && partial.wire == 0) return partial.varintNumber();
      partial.skip();
    }
  }

  return 0;
};
