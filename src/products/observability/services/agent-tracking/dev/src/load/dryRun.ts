import mongoose from 'mongoose';
import { createIngestFetch } from '@mtsrc/agent-tracking-api-ingest';
import { emptyTokens, type Tokens } from '@mtsrc/agent-tracking-cost';
import { createOrganizationKeyDeriver } from '@mtsrc/agent-tracking-crypto';
import { createRuntime, setRuntime } from '@mtsrc/agent-tracking-module-ingest';
import {
  createMemorySink,
  setRecordSink,
  toRecordDocument
} from '@mtsrc/agent-tracking-module-records';
import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';
import { principalFixture } from '@mtsrc/agent-tracking-records-model/test/principal';
import { realClock } from '../lib/clock';
import { summarize, type Summary } from '../lib/stats';
import {
  backfillExpectedTypes,
  backfillItems,
  encodeBackfillRequest,
  encodeLiveRequest,
  rejectedOfOtlpResponse,
  type Compression,
  type EncodedRequest,
  type PayloadFormat
} from './payload';
import type { TrafficProfile } from './profile';
import { createBatchStream, type ExpectedRecord } from './synth';

let dryRunHost = 'http://dry-run.invalid';

let tokenKeys = ['inputUncached', 'cacheRead', 'cacheWrite', 'output'] as const;

export type DryRunReport = {
  ok: boolean;
  problems: string[];
  live: {
    requests: number;
    records: number;
    stored: number;
    byType: Record<string, { expected: number; stored: number }>;
    tokens: { expected: Tokens; stored: Tokens };
    costUsd: { expected: number; stored: number };
    failedRequests: { expected: number; stored: number };
    bodyBytes: Summary;
  };
  backfill: { requests: number; items: number; accepted: number; stored: number };
  documentBytes: { all: Summary; byType: Record<string, Summary> };
  inProcess: { recordsPerSecond: number; note: string };
};

let closeTo = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;

// The service's own ingest handler, parser, dialects and record builder, writing into the memory
// sink: no network, no database.
export let createInProcessIngest = () => {
  let sink = createMemorySink({ maxRecords: Number.MAX_SAFE_INTEGER });
  let runtime = createRuntime({
    keys: createOrganizationKeyDeriver('agent-tracking-dry-run'),
    clock: () => new Date(),
    stages: []
  });
  let principal = principalFixture(
    { suffix: 'dryrun' },
    {
      credential: { kind: 'source', id: 'atis_dryrun', family: 'claude-code' },
      binding: { userId: undefined, deviceId: undefined, deviceMode: 'ephemeral' }
    }
  );
  let fetch = createIngestFetch(async () => principal);

  setRuntime(runtime);
  setRecordSink(sink);

  let send = async (request: EncodedRequest) =>
    fetch(
      new Request(`${dryRunHost}${request.path}`, {
        method: 'POST',
        headers: { ...request.headers, authorization: 'Bearer dry-run' },
        body: request.body as BodyInit
      })
    );

  return { sink, send, handle: (request: Request) => fetch(request) };
};

export let runDryRun = async (d: {
  profile: TrafficProfile;
  seed: number;
  batches: number;
  backfillRequests: number;
  format: PayloadFormat;
  compression: Compression;
}): Promise<DryRunReport> => {
  let problems: string[] = [];
  let { sink, send } = createInProcessIngest();

  let stream = createBatchStream({ profile: d.profile, seed: d.seed, clock: realClock.now });
  let expected: ExpectedRecord[] = [];
  let bodyBytes: number[] = [];
  let elapsedMs = 0;

  for (let index = 0; index < d.batches; index++) {
    let batch = stream.next();
    let request = encodeLiveRequest(batch.group, batch.expected.length, {
      format: d.format,
      compression: d.compression
    });

    expected.push(...batch.expected);
    bodyBytes.push(request.body.length);

    let started = performance.now();
    let response = await send(request);
    let bytes = new Uint8Array(await response.arrayBuffer());
    elapsedMs += performance.now() - started;

    if (response.status != 200) {
      problems.push(`live request ${index} answered ${response.status}`);
      continue;
    }

    let rejected = rejectedOfOtlpResponse(bytes, response.headers.get('content-type'));
    if (rejected > 0) problems.push(`live request ${index} rejected ${rejected} records`);
  }

  let liveRecords = sink.list({ lane: 'live' }).map(item => item.record);
  sink.clear();

  let backfillAccepted = 0;
  let backfillSent = 0;

  for (let index = 0; index < d.backfillRequests; index++) {
    let now = Date.now();
    let items = backfillItems({ profile: d.profile, seed: d.seed, batchNumber: index, now });
    let response = await send(
      encodeBackfillRequest(items, {
        batchId: `dry-run-${index}`,
        now,
        compression: d.compression
      })
    );

    backfillSent += items.length;

    if (response.status != 200) {
      problems.push(`backfill request ${index} answered ${response.status}`);
      continue;
    }

    let result = (await response.json()) as { accepted: number; rejected: number };
    backfillAccepted += result.accepted;
    if (result.rejected > 0) {
      problems.push(`backfill request ${index} rejected ${result.rejected} items`);
    }
  }

  let backfillRecords = sink.list({ lane: 'backfill' }).map(item => item.record);
  sink.clear();

  let report = compareLive({ expected, records: liveRecords, profile: d.profile, problems });

  for (let record of backfillRecords) {
    if (!backfillExpectedTypes.includes(record.type)) {
      problems.push(`backfill produced an unexpected ${record.type} record`);
    }
    if (!record.ingest.backfill) problems.push('a backfill record is not marked as backfill');
  }

  checkNoContent([...liveRecords, ...backfillRecords], d.profile, problems);

  let documentBytes = measureDocuments([...liveRecords, ...backfillRecords], problems);

  return {
    ok: problems.length == 0,
    problems,
    live: {
      requests: d.batches,
      records: expected.length,
      stored: liveRecords.length,
      ...report,
      bodyBytes: summarize(bodyBytes)
    },
    backfill: {
      requests: d.backfillRequests,
      items: backfillSent,
      accepted: backfillAccepted,
      stored: backfillRecords.length
    },
    documentBytes,
    inProcess: {
      recordsPerSecond: elapsedMs > 0 ? Math.round((expected.length / elapsedMs) * 1000) : 0,
      note: 'Decode, dialect and record build on one core into the memory sink; doc 03 Phase 1 suggests a floor of 50,000 records/s/core. Informational only.'
    }
  };
};

let compareLive = (d: {
  expected: ExpectedRecord[];
  records: NormalizedRecord[];
  profile: TrafficProfile;
  problems: string[];
}) => {
  let { problems } = d;
  let byType: Record<string, { expected: number; stored: number }> = {};
  let tokens = { expected: emptyTokens(), stored: emptyTokens() };
  let costUsd = { expected: 0, stored: 0 };
  let failedRequests = { expected: 0, stored: 0 };

  let entry = (type: string) => (byType[type] ??= { expected: 0, stored: 0 });

  for (let item of d.expected) {
    entry(item.type).expected++;

    if (item.type != 'model.request') continue;
    if (item.outcome == 'error') {
      failedRequests.expected++;
      continue;
    }

    for (let key of tokenKeys) tokens.expected[key] += item.tokens[key];
    costUsd.expected += item.costUsd;
  }

  for (let record of d.records) {
    entry(record.type).stored++;

    if (record.kind != 'event')
      problems.push(`a ${record.type} record has kind ${record.kind}`);
    if (record.source.dialect != 'claude-code.otlp.v1') {
      problems.push(`a record was mapped by ${record.source.dialect}`);
    }
    if (record.type != 'model.request') continue;

    let data = record.data as {
      outcome?: string;
      usage?: Partial<Record<string, number>>;
      cost?: { amount?: string; unit?: string };
      model?: { id?: string };
    };

    if (!data.model?.id) problems.push('a model.request record has no model');

    if (data.outcome == 'error') {
      failedRequests.stored++;
      continue;
    }

    tokens.stored.inputUncached += data.usage?.input_uncached ?? 0;
    tokens.stored.cacheRead += data.usage?.cache_read ?? 0;
    tokens.stored.cacheWrite += data.usage?.cache_write ?? 0;
    tokens.stored.output += data.usage?.output ?? 0;

    if (data.cost?.unit != 'usd') problems.push('a model.request record has no USD cost');
    costUsd.stored += Number(data.cost?.amount ?? 0);
  }

  if (d.records.length != d.expected.length) {
    problems.push(
      `${d.expected.length} live records were sent and ${d.records.length} stored`
    );
  }

  for (let [type, counts] of Object.entries(byType)) {
    if (counts.expected != counts.stored) {
      problems.push(`${type}: ${counts.expected} expected, ${counts.stored} stored`);
    }
  }

  for (let key of tokenKeys) {
    if (tokens.expected[key] != tokens.stored[key]) {
      problems.push(
        `tokens.${key}: ${tokens.expected[key]} sent, ${tokens.stored[key]} stored`
      );
    }
  }

  if (!closeTo(costUsd.expected, costUsd.stored, 1e-6 * Math.max(1, d.expected.length))) {
    problems.push(`cost: ${costUsd.expected} USD sent, ${costUsd.stored} USD stored`);
  }

  if (failedRequests.expected != failedRequests.stored) {
    problems.push(
      `failed requests: ${failedRequests.expected} sent, ${failedRequests.stored} stored`
    );
  }

  return { byType, tokens, costUsd, failedRequests };
};

let checkNoContent = (
  records: NormalizedRecord[],
  profile: TrafficProfile,
  problems: string[]
) => {
  let domain = `@${profile.identityDomain}`;

  for (let record of records) {
    if (record.content.length > 0) {
      problems.push(`a ${record.type} record carries content`);
      return;
    }

    let email = record.actor?.user?.email;
    if (email !== undefined && !email.endsWith(domain)) {
      problems.push(`a record carries an email outside ${domain}`);
      return;
    }
  }
};

let measureDocuments = (records: NormalizedRecord[], problems: string[]) => {
  let all: number[] = [];
  let byType: Record<string, number[]> = {};
  let now = new Date();

  for (let record of records) {
    let mapped = toRecordDocument(record, { storage: defaultStoragePolicy, now });

    if (!mapped) {
      problems.push(`a ${record.type} record maps to no document`);
      continue;
    }
    if (mapped.texts.length) problems.push(`a ${record.type} record stores content text`);

    let size = mongoose.mongo.BSON.calculateObjectSize(mapped.document);
    all.push(size);
    (byType[record.type] ??= []).push(size);
  }

  return {
    all: summarize(all),
    byType: Object.fromEntries(
      Object.entries(byType).map(([type, sizes]) => [type, summarize(sizes)])
    )
  };
};
